#!/usr/bin/env node
/**
 * Run focused e2e diagnostics experiments (SSR Cypress at cy=2 vs cy=6).
 * Usage: node scripts/run-e2e-diag-suite.mjs [--full]
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { diagDir } from "../e2e/shared/e2e-diag.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const full = process.argv.includes("--full")

/** @type {{ id: string; concurrency: number; filter?: string }[]} */
const experiments = full
  ? [
      { id: "full-cy2", concurrency: 2 },
      { id: "full-cy6", concurrency: 6 },
    ]
  : [
      { id: "ssr-only-cy2", concurrency: 2, filter: "ssr" },
      { id: "ssr-only-cy6", concurrency: 6, filter: "ssr" },
    ]

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 */
function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    child.stdout?.on("data", (d) => {
      const s = d.toString()
      out += s
      process.stdout.write(s)
    })
    child.stderr?.on("data", (d) => {
      const s = d.toString()
      out += s
      process.stderr.write(s)
    })
    child.on("close", (code) => resolve({ code: code ?? 1, out }))
  })
}

async function main() {
  const manifest = []
  for (const exp of experiments) {
    const expDir = path.join(diagDir(), exp.id)
    fs.mkdirSync(expDir, { recursive: true })
    rmrf(path.join(root, ".builderman"))
    rmrf(path.join(root, ".e2e-diag"))
    fs.mkdirSync(expDir, { recursive: true })

    const logPath = path.join(expDir, "test.log")
    const env = {
      KIRU_E2E_DIAG: "1",
      KIRU_RPC_TRACE: "1",
      KIRU_RPC_TRACE_FILE: path.join(expDir, "rpc-trace.jsonl"),
      KIRU_E2E_CONCURRENCY: String(exp.concurrency),
      ...(exp.filter ? { KIRU_E2E_DIAG_FILTER: exp.filter } : {}),
    }

    console.log(`\n[e2e-diag] experiment ${exp.id} starting…`)
    const sampler = spawn("node", ["scripts/e2e-diag-sampler.mjs"], {
      cwd: root,
      env: { ...process.env, ...env },
      detached: true,
      stdio: "ignore",
    })
    sampler.unref()

    const t0 = Date.now()
    const { code, out } = await run("node", ["builderman.js", "test"], env)
    fs.writeFileSync(logPath, out, "utf8")

    try {
      process.kill(sampler.pid, "SIGTERM")
    } catch {
      /* sampler may have exited */
    }

    const samplerSrc = path.join(root, ".e2e-diag", "sampler.jsonl")
    if (fs.existsSync(samplerSrc)) {
      fs.copyFileSync(samplerSrc, path.join(expDir, "sampler.jsonl"))
    }
    const eventsGlob = path.join(root, ".e2e-diag")
    if (fs.existsSync(eventsGlob)) {
      for (const f of fs.readdirSync(eventsGlob)) {
        if (f.startsWith("events-") && f.endsWith(".jsonl")) {
          fs.copyFileSync(
            path.join(eventsGlob, f),
            path.join(expDir, f)
          )
        }
      }
    }

    const durationMs = Date.now() - t0
    const failedMatch = out.match(/Task begin: (e2e[^\s]*)/g)
    manifest.push({
      id: exp.id,
      concurrency: exp.concurrency,
      filter: exp.filter ?? "full",
      durationMs,
      ok: code === 0,
      exitCode: code,
      failedTask: code !== 0 ? failedMatch?.[failedMatch.length - 1] : undefined,
    })
    console.log(
      `[e2e-diag] ${exp.id} ${code === 0 ? "OK" : "FAIL"} in ${(durationMs / 1000).toFixed(1)}s`
    )
  }

  fs.writeFileSync(
    path.join(diagDir(), "experiments.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  )

  const analyze = await run(
    "node",
    ["scripts/analyze-e2e-diag.mjs"],
    { KIRU_E2E_DIAG: "1" }
  )
  process.exit(analyze.code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
