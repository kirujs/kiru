#!/usr/bin/env node
/**
 * Analyze .e2e-diag experiment output and write report.md
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { diagDir } from "../e2e/shared/e2e-diag.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const diagRoot = diagDir()

const beginRe = /^~~~~~ Task begin: (.+)$/
const completeRe = /^~~~~~ Task complete: (.+)$/

/** @param {string} logPath */
function parseTaskSpans(logPath) {
  if (!fs.existsSync(logPath)) return new Map()
  const lines = fs.readFileSync(logPath, "utf8").split("\n")
  /** @type {Map<string, number>} */
  const stack = new Map()
  /** @type {Map<string, number>} */
  const durations = new Map()
  let lineNo = 0
  for (const line of lines) {
    lineNo++
    const b = line.match(beginRe)
    if (b) {
      stack.set(b[1], lineNo)
      continue
    }
    const c = line.match(completeRe)
    if (c) {
      const start = stack.get(c[1])
      if (start !== undefined) {
        durations.set(c[1], lineNo - start)
        stack.delete(c[1])
      }
    }
  }
  return durations
}

/** @param {string} file */
function readJsonl(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** @param {number[]} arr */
function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const i = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length)
  )
  return sorted[i]
}

/** @param {object[]} rpcEvents */
function classifyRpc(rpcEvents) {
  const phases = rpcEvents.map((e) => e.phase)
  const has = (p) => phases.includes(p)
  const serverInvokeEnd = rpcEvents.filter(
    (e) => e.side === "server" && e.phase === "invoke_end"
  )
  const clientFetchDone = rpcEvents.filter(
    (e) => e.side === "client" && e.phase === "fetch_done"
  )
  const verdicts = []
  if (
    serverInvokeEnd.some((e) => (e.durationMs ?? 0) > 5000) &&
    clientFetchDone.some((e) => (e.durationMs ?? 0) > 5000)
  ) {
    verdicts.push({ id: "H4", verdict: "supported", note: "Slow loader/action RPC" })
  }
  if (has("invoke_end") && !has("fetch_done")) {
    verdicts.push({
      id: "H8",
      verdict: "supported",
      note: "Server finished without client fetch_done",
    })
  }
  if (
    has("fetch_done") &&
    clientFetchDone.some((e) => e.status === 200) &&
    has("page_load_discarded")
  ) {
    verdicts.push({
      id: "H9",
      verdict: "supported",
      note: "RPC OK but navigation commit discarded",
    })
  }
  if (has("cache_hit") && has("prefetch_done") && has("page_load_discarded")) {
    verdicts.push({
      id: "H10",
      verdict: "inconclusive",
      note: "Prefetch cache present; click path may not have committed",
    })
  }
  if (
    has("fetch_done") &&
    clientFetchDone.some((e) => e.status === 200) &&
    phases.filter((p) => p === "binding" || p === "scheduler").length > 0
  ) {
    verdicts.push({
      id: "H7",
      verdict: "inconclusive",
      note: "RPC OK; check readiness/hydration after fetch",
    })
  }
  return verdicts
}

function main() {
  const manifestPath = path.join(diagRoot, "experiments.json")
  if (!fs.existsSync(manifestPath)) {
    console.error("No experiments.json — run scripts/run-e2e-diag-suite.mjs first")
    process.exit(1)
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  const lines = ["# E2E parallel diagnostics report", ""]

  for (const exp of manifest) {
    const expDir = path.join(diagRoot, exp.id)
    lines.push(`## ${exp.id}`)
    lines.push("")
    lines.push(
      `- **Result:** ${exp.ok ? "pass" : "fail"} (${(exp.durationMs / 1000).toFixed(1)}s wall)`
    )
    lines.push(`- **Concurrency:** ${exp.concurrency}`)
    lines.push(`- **Filter:** ${exp.filter}`)
    if (exp.failedTask) lines.push(`- **Failed task:** ${exp.failedTask}`)
    lines.push("")

    const logPath = path.join(expDir, "test.log")
    const durations = parseTaskSpans(logPath)
    const loadersSpan = durations.get("e2e:ssr:cy-loaders")
    if (loadersSpan) {
      lines.push(`- e2e:ssr:cy-loaders line-span proxy: ${loadersSpan}`)
    }

    const sampler = readJsonl(path.join(expDir, "sampler.jsonl"))
    if (sampler.length) {
      const cpu = sampler.map((s) => s.cpuPct).filter((n) => typeof n === "number")
      const mem = sampler.map((s) => s.memUsedPct).filter((n) => typeof n === "number")
      const ports = sampler.map((s) => s.activeDevPorts).filter((n) => typeof n === "number")
      lines.push(
        `- Sampler CPU p50/p95: ${percentile(cpu, 50)}% / ${percentile(cpu, 95)}%`
      )
      lines.push(
        `- Sampler mem p50/p95: ${percentile(mem, 50)}% / ${percentile(mem, 95)}%`
      )
      lines.push(
        `- Active dev ports p95: ${percentile(ports, 95)}`
      )
      if (percentile(cpu, 95) > 85) {
        lines.push("- **H1 CPU saturation:** supported at p95")
      } else {
        lines.push("- **H1 CPU saturation:** not supported at p95")
      }
      if (percentile(mem, 95) > 90) {
        lines.push("- **H2 memory pressure:** supported at p95")
      } else {
        lines.push("- **H2 memory pressure:** not supported at p95")
      }
    }

    const viteEvents = fs
      .readdirSync(expDir)
      .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"))
      .flatMap((f) => readJsonl(path.join(expDir, f)))
    const viteListen = viteEvents
      .filter((e) => e.kind === "vite_listen")
      .map((e) => e.vite_listen_ms)
      .filter((n) => typeof n === "number")
    if (viteListen.length) {
      lines.push(
        `- Vite listen p95: ${percentile(viteListen, 95)}ms (**H3** if much higher at cy6)`
      )
    }

    const rpc = readJsonl(path.join(expDir, "rpc-trace.jsonl"))
    if (rpc.length) {
      lines.push("")
      lines.push("### RPC timeline (sample)")
      lines.push("")
      for (const e of rpc.slice(-20)) {
        lines.push(
          `- \`${e.side}\` ${e.channel}/${e.phase} ${e.durationMs ? `${e.durationMs}ms` : ""} ${e.error ?? ""}`
        )
      }
      const rpcVerdicts = classifyRpc(rpc)
      if (rpcVerdicts.length) {
        lines.push("")
        lines.push("### RPC hypotheses")
        for (const v of rpcVerdicts) {
          lines.push(`- **${v.id}:** ${v.verdict} — ${v.note}`)
        }
      }
    }

    const failDumps = viteEvents.filter((e) => e.kind === "loader_assert_fail")
    for (const dump of failDumps) {
      if (dump.rpcTrace?.length) {
        lines.push("")
        lines.push("### Cypress failure RPC dump")
        classifyRpc(dump.rpcTrace).forEach((v) => {
          lines.push(`- **${v.id}:** ${v.verdict} — ${v.note}`)
        })
      }
    }

    lines.push("")
  }

  const cy2 = manifest.find((e) => e.id.includes("cy2"))
  const cy6 = manifest.find((e) => e.id.includes("cy6"))
  if (cy2 && cy6) {
    lines.push("## Recommendation")
    lines.push("")
    if (cy6.ok && cy6.durationMs < cy2.durationMs * 0.85) {
      lines.push(
        `- cy=6 completed faster and green — consider raising default \`KIRU_E2E_CONCURRENCY\` on this machine.`
      )
    } else if (!cy6.ok && cy2.ok) {
      lines.push(
        `- cy=6 failed while cy=2 passed — keep conservative default; inspect H4/H7/H9 in RPC traces above.`
      )
    } else {
      lines.push("- Results mixed — review per-experiment RPC and sampler sections.")
    }
    lines.push("")
  }

  const reportPath = path.join(diagRoot, "report.md")
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8")
  console.log(lines.join("\n"))
  console.log(`\nWrote ${reportPath}`)
}

main()
