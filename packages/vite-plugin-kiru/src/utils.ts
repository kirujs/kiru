import path from "node:path"
import { ANSI } from "./ansi.js"
import type { PluginState } from "./config.js"

export function createLogger(state: PluginState) {
  return (...data: any[]) => {
    if (!state.loggingEnabled) return
    console.log(ANSI.cyan("[vite-plugin-kiru]"), ...data)
  }
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
