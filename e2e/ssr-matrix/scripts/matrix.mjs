import { MATRIX_CELL_IDS } from "./cells.mjs"
import { commandExists, run } from "./lib.mjs"

const skipBun = !(await commandExists("bun"))
if (skipBun) {
  console.warn("bun not on PATH — skipping bun-* cells")
}

let failed = 0
for (const id of MATRIX_CELL_IDS) {
  if (id.startsWith("bun-") && skipBun) {
    console.log(`[${id}] skipped`)
    continue
  }
  console.log(`\n=== matrix cell: ${id} ===\n`)
  try {
    await run("node", ["./scripts/run-cell.mjs"], {
      env: { KIRU_MATRIX_CELL: id, NODE_ENV: "production" },
    })
  } catch (err) {
    console.error(`[${id}] failed:`, err instanceof Error ? err.message : err)
    failed++
  }
}

if (failed > 0) {
  console.error(`\n${failed} matrix cell(s) failed`)
  process.exit(1)
}
console.log("\nAll matrix cells passed")
