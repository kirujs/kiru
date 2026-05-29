import os from "node:os"
import { MATRIX_CELL_IDS } from "./cells.mjs"
import { commandExists, run } from "./lib.mjs"

const skipBun = !(await commandExists("bun"))
if (skipBun) {
  console.warn("bun not on PATH — skipping bun-* cells")
}

const defaultConcurrency = process.env.CI
  ? Math.min(os.availableParallelism?.() ?? 4, 4)
  : 3
const concurrency = Math.max(
  1,
  Number(process.env.KIRU_MATRIX_CONCURRENCY) || defaultConcurrency
)
const defaultWranglerConcurrency =
  process.env.CI && process.platform !== "win32" ? 2 : 1
const wranglerConcurrency = Math.max(
  1,
  Number(process.env.KIRU_MATRIX_WRANGLER_CONCURRENCY) || defaultWranglerConcurrency
)

const runnable = MATRIX_CELL_IDS.filter((id) => !(id.startsWith("bun-") && skipBun))
const nodeBunIds = runnable.filter((id) => !id.startsWith("worker-"))
const workerIds = runnable.filter((id) => id.startsWith("worker-"))

/**
 * @param {string[]} ids
 * @param {number} limit
 * @param {(id: string) => Promise<void>} fn
 */
async function runPool(ids, limit, fn) {
  const queue = [...ids]
  let failed = 0
  let index = 0

  async function worker() {
    while (true) {
      const i = index++
      if (i >= queue.length) return
      const id = queue[i]
      console.log(`\n=== matrix cell: ${id} ===\n`)
      try {
        await fn(id)
      } catch (err) {
        console.error(
          `[${id}] failed:`,
          err instanceof Error ? err.message : err
        )
        failed++
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, () => worker()))
  return failed
}

async function runCell(id) {
  await run("node", ["./scripts/run-cell.mjs"], {
    env: { KIRU_MATRIX_CELL: id, NODE_ENV: "production" },
  })
}

let failed = 0
if (nodeBunIds.length > 0) {
  failed += await runPool(nodeBunIds, concurrency, runCell)
}
if (workerIds.length > 0) {
  failed += await runPool(workerIds, wranglerConcurrency, runCell)
}

if (failed > 0) {
  console.error(`\n${failed} matrix cell(s) failed`)
  process.exit(1)
}
console.log("\nAll matrix cells passed")
