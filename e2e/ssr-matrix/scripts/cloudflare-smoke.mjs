/**
 * PR smoke: one Cloudflare Worker cell + runtime ISR guard sanity check.
 */
import { assertISRAllowed } from "@kirujs/runtime"
import { run } from "./lib.mjs"

const CELL = "worker-hono"

console.log("=== cloudflare-smoke: ISR guard ===\n")
try {
  assertISRAllowed("cloudflare", { revalidate: 60 }, { routeId: "/bad" })
  console.error("expected assertISRAllowed to throw for revalidate: 60")
  process.exit(1)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes("cloudflare")) {
    console.error("unexpected error:", msg)
    process.exit(1)
  }
  console.log("ISR guard rejects timed revalidate on cloudflare (ok)")
}

console.log(`\n=== cloudflare-smoke: matrix cell ${CELL} ===\n`)
try {
  await run("node", ["./scripts/run-cell.mjs"], {
    env: { KIRU_MATRIX_CELL: CELL, NODE_ENV: "production" },
  })
} catch (err) {
  console.error(`[${CELL}] failed:`, err instanceof Error ? err.message : err)
  process.exit(1)
}

console.log("\ncloudflare-smoke passed")
