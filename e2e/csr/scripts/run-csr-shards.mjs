import { spawnSync } from "node:child_process"

const shards = [
  "cypress.shard-core.config.ts",
  "cypress.shard-features.config.ts",
  "cypress.shard-advanced.config.ts",
]

let failed = 0
for (const config of shards) {
  console.log(`\n=== CSR shard: ${config} ===\n`)
  const r = spawnSync(
    "pnpm",
    ["exec", "cypress", "run", "--config-file", config],
    { stdio: "inherit", shell: process.platform === "win32" }
  )
  if (r.status !== 0) failed++
}

process.exit(failed > 0 ? 1 : 0)
