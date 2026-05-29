import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

const requiredArtifacts = [
  "dist/server/index.js",
  "dist/client/index.html",
  "dist/client/revalidate-demo.html",
  "dist/client/revalidate-demo.prerender-meta.json",
]

const buildNeeded =
  process.env.KIRU_FORCE_E2E_BUILD === "1" ||
  requiredArtifacts.some((p) => !existsSync(p))

if (buildNeeded) {
  const r = spawnSync("pnpm", ["run", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  process.exit(r.status ?? 1)
}
