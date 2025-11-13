import path from "node:path"
import { globSync } from "glob"
import type { PluginState } from "./config.js"
import { ANSI } from "./ansi.js"
import { SSGOptions, SSROptions } from "./types.js"

export function createLogger(state: PluginState) {
  return (...data: any[]) => {
    if (!state.loggingEnabled) return
    console.log(ANSI.cyan("[vite-plugin-kiru]"), ...data)
  }
}

export function resolveUserDocument(
  projectRoot: string,
  options: { dir: string; document: string }
): string {
  const { dir, document } = options
  const fp = path.resolve(projectRoot, dir, document).replace(/\\/g, "/")
  const matches = globSync(fp)
  if (!matches.length) {
    throw new Error(`Document not found at ${fp}`)
  }

  return path.resolve(projectRoot, matches[0]).replace(/\\/g, "/")
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
