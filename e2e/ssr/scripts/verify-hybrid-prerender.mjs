import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const e2eRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const clientDir = path.join(e2eRoot, "dist", "client")
const docsHtml = path.join(clientDir, "docs.html")
const serverEntry = path.join(e2eRoot, "dist", "server", "index.js")

const errors = []
if (!fs.existsSync(docsHtml)) {
  errors.push(`missing prerendered ${path.relative(e2eRoot, docsHtml)}`)
}
if (!fs.existsSync(serverEntry)) {
  errors.push(`missing SSR bundle ${path.relative(e2eRoot, serverEntry)}`)
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log("[e2e/ssr] hybrid build artifacts ok")
