import path from "node:path"
import fs from "node:fs"
import type { PluginState } from "./config.js"
import { ANSI } from "./ansi.js"
import { SSGOptions } from "./types.js"

export function createLogger(state: PluginState) {
  return (...data: any[]) => {
    if (!state.loggingEnabled) return
    console.log(ANSI.cyan("[vite-plugin-kiru]"), ...data)
  }
}

export function resolveUserDocument(
  projectRoot: string,
  ssgOptions: Required<SSGOptions>
): string {
  const { dir, document } = ssgOptions
  const fp = path.resolve(projectRoot, dir, document)
  if (fs.existsSync(fp)) return fp.replace(/\\/g, "/")
  throw new Error(`Document not found at ${fp}`)
}

const TRANSFORMABLE_EXTENSIONS = new Set([
  ".tsx",
  ".jsx",
  ".ts",
  ".js",
  ".mjs",
  ".mts",
  ".md",
  ".mdx",
])

export function shouldTransformFile(id: string, state: PluginState): boolean {
  // Fast exclusions
  if (
    id[0] === "\0" ||
    id.startsWith("vite:") ||
    id.includes("/node_modules/")
  ) {
    return false
  }

  const filePath = path.resolve(id).replace(/\\/g, "/")
  const isIncludedByUser = state.includedPaths.some((p) =>
    filePath.startsWith(p)
  )
  const isWithinProject = filePath.startsWith(state.projectRoot)

  return (
    (isWithinProject || isIncludedByUser) &&
    TRANSFORMABLE_EXTENSIONS.has(path.extname(filePath))
  )
}
