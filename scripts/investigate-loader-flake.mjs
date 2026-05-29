#!/usr/bin/env node
/**
 * Stress SSR Cypress shards in parallel (simulates KIRU_E2E_CONCURRENCY=3)
 * with RPC trace + e2e diag. Stops on first failure or after --iterations N.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { diagDir } from "../e2e/shared/e2e-diag.mjs"
import { e2ePorts } from "../e2e/shared/ports.mjs"
import { cypressProfileEnv } from "./builderman/cypress-profile.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const ssrCwd = path.join(root, "e2e/ssr")
const iterations = Number(process.argv.find((a) => a.startsWith("--iterations="))?.split("=")[1]) || 5

const shards = [
  { name: "loaders", config: "cypress.shard-loaders.config.ts", port: e2ePorts.ssr.loaders.dev },
  { name: "streaming", config: "cypress.shard-streaming.config.ts", port: e2ePorts.ssr.streaming.dev },
  { name: "core", config: "cypress.shard-core.config.ts", port: e2ePorts.ssr.core.dev },
]

function run(cmd, args, env, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
    })
    let out = ""
    child.stdout?.on("data", (d) => {
      const s = d.toString()
      out += s
      process.stdout.write(`[${env.KIRU_SHARD_NAME}] ${s}`)
    })
    child.stderr?.on("data", (d) => {
      const s = d.toString()
      out += s
      process.stderr.write(`[${env.KIRU_SHARD_NAME}] ${s}`)
    })
    child.on("close", (code) => resolve({ code: code ?? 1, out }))
  })
}

async function ensureSsrBuilt() {
  console.log("[investigate] building kiru + e2e/ssr…")
  const lib = await run("pnpm", ["--filter", "kiru", "run", "build"], {}, root)
  if (lib.code !== 0) {
    console.error("[investigate] lib build failed")
    process.exit(1)
  }
  const r = await run("pnpm", ["run", "build"], {}, ssrCwd)
  if (r.code !== 0) {
    console.error("[investigate] ssr build failed")
    process.exit(1)
  }
}

async function runParallelStress(iter) {
  const expDir = path.join(diagDir(), `stress-iter-${iter}`)
  fs.mkdirSync(expDir, { recursive: true })
  const envBase = {
    KIRU_E2E_DIAG: "1",
    KIRU_RPC_TRACE: "1",
    KIRU_RPC_TRACE_FILE: path.join(expDir, "rpc-trace.jsonl"),
    NODE_ENV: "development",
  }

  console.log(`\n[investigate] iteration ${iter}/${iterations} — 3 parallel Cypress shards`)
  const results = await Promise.all(
    shards.map(async (shard) => {
      const t0 = Date.now()
      const r = await run(
        "pnpm",
        ["exec", "cypress", "run", "--config-file", shard.config],
        { ...envBase, ...cypressProfileEnv(shard.port), KIRU_SHARD_NAME: shard.name },
        ssrCwd
      )
      const logPath = path.join(expDir, `${shard.name}.log`)
      fs.writeFileSync(logPath, r.out, "utf8")
      const failed =
        r.code !== 0 ||
        /AssertionError|Timed out retrying/i.test(r.out) ||
        /│\s*✖\s/.test(r.out) ||
        /\d+\s+failing/i.test(r.out) ||
        /,\s*[1-9]\d*\s+failing/i.test(r.out)
      return {
        shard: shard.name,
        code: r.code,
        ms: Date.now() - t0,
        failed,
      }
    })
  )
  return results
}

async function main() {
  fs.mkdirSync(diagDir(), { recursive: true })
  await ensureSsrBuilt()

  const sampler = spawn("node", ["scripts/e2e-diag-sampler.mjs"], {
    cwd: root,
    env: { ...process.env, KIRU_E2E_DIAG: "1" },
    detached: true,
    stdio: "ignore",
  })
  sampler.unref()

  const summary = []
  for (let i = 1; i <= iterations; i++) {
    const results = await runParallelStress(i)
    const anyFail = results.some((r) => r.code !== 0 || r.failed)
    summary.push({ iter: i, results, anyFail })
    if (anyFail) {
      console.error(`\n[investigate] FAILURE on iteration ${i}`)
      for (const r of results) {
        console.error(`  ${r.shard}: exit=${r.code} failedPattern=${r.failed} ${r.ms}ms`)
      }
      try {
        process.kill(sampler.pid, "SIGTERM")
      } catch {
        /* */
      }
      await run("node", ["scripts/analyze-e2e-diag.mjs"], { KIRU_E2E_DIAG: "1" }, root)
      process.exit(1)
    }
  }

  try {
    process.kill(sampler.pid, "SIGTERM")
  } catch {
    /* */
  }

  console.log("\n[investigate] All iterations passed.")
  for (const s of summary) {
    const loaders = s.results.find((r) => r.shard === "loaders")
    console.log(
      `  iter ${s.iter}: loaders ${loaders?.ms}ms, streaming ${s.results.find((r) => r.shard === "streaming")?.ms}ms, core ${s.results.find((r) => r.shard === "core")?.ms}ms`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
