import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const e2eRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const serverEntry = path.join(e2eRoot, "dist", "server", "index.js")

/** Ensure dist/server/index.js only references chunks that exist on disk. */
export function assertServerBundleConsistent(entry = serverEntry) {
  if (!fs.existsSync(entry)) {
    throw new Error(
      `missing SSR bundle ${path.relative(e2eRoot, entry)} — run pnpm run build in e2e/ssr`
    )
  }
  const entryDir = path.dirname(entry)
  const src = fs.readFileSync(entry, "utf8")
  const refs = new Set()
  for (const m of src.matchAll(/["'](\.\/assets\/[^"']+\.js)["']/g)) {
    refs.add(m[1])
  }
  const missing = []
  for (const rel of refs) {
    if (!fs.existsSync(path.join(entryDir, rel))) {
      missing.push(rel)
    }
  }
  if (missing.length) {
    throw new Error(
      `stale server bundle (${missing.length} missing chunk(s), e.g. ${missing[0]}). Run pnpm run build in e2e/ssr.`
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assertServerBundleConsistent()
  console.log("[e2e/ssr] server bundle chunks ok")
}
