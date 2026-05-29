import fs from "node:fs/promises"
import path from "node:path"
import { getCellConfig } from "./cells.mjs"
import { cellWranglerConfig } from "./cell-dist.mjs"
import {
  cellBuildCommand,
  cellStartCommand,
  commandExists,
  getFreePort,
  packageRoot,
  run,
  spawnServer,
  waitFor,
} from "./lib.mjs"
import { smokeMatrix } from "./smoke-core.mjs"

const cell = getCellConfig(process.env.KIRU_MATRIX_CELL)

if (cell.runtime === "bun" && !(await commandExists("bun"))) {
  console.error(`[${cell.id}] skipped: bun not on PATH`)
  process.exit(0)
}

const build = cellBuildCommand(cell)
console.log(`[${cell.id}] build (${build.command} ${build.args.join(" ")})`)
await run(build.command, build.args, {
  cwd: packageRoot,
  env: {
    KIRU_MATRIX_CELL: cell.id,
    // Vite config load must not resolve `kiru/router` to the browser client entry.
    NODE_ENV: "development",
  },
})

if (cell.runtime === "wrangler") {
  const generated = path.join(packageRoot, "wrangler.toml.generated")
  const perCell = path.join(packageRoot, cellWranglerConfig(cell.id))
  await fs.copyFile(generated, perCell)
}

const port = await getFreePort()
const start = cellStartCommand(cell, port)
console.log(`[${cell.id}] start ${start.command} ${start.args.join(" ")} (port ${port})`)

const child = spawnServer(start, port)
child.stdout?.on("data", (d) => process.stdout.write(d))
child.stderr?.on("data", (d) => process.stderr.write(d))

let passed = false
try {
  const base = `http://127.0.0.1:${port}`
  const attempts = cell.runtime === "wrangler" ? 120 : 60
  await waitFor(`${base}/`, attempts)
  await smokeMatrix(base, { frameworkHealth: cell.frameworkHealth === true })
  console.log(`[${cell.id}] smoke passed`)
  passed = true
} finally {
  child.kill("SIGTERM")
  await new Promise((r) => setTimeout(r, 500))
  if (!child.killed) child.kill("SIGKILL")
}

process.exit(passed ? 0 : 1)
