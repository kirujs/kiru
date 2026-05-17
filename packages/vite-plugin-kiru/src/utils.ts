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

/** Resolve a Vite module id to an absolute project file path. */
export function normalizeModulePath(id: string, projectRoot: string): string {
  const cleaned = id.split("?")[0].split("#")[0]
  const root = path.resolve(projectRoot).replace(/\\/g, "/")
  let resolved = path.resolve(cleaned).replace(/\\/g, "/")
  if (resolved === root || resolved.startsWith(`${root}/`)) {
    return resolved
  }
  // Vite often passes root-absolute ids like `/src/pages/foo.ts`; on Windows
  // `path.resolve` maps those outside the project (e.g. `C:\src\...`).
  const posix = cleaned.replace(/\\/g, "/")
  if (posix.startsWith("/")) {
    return path.join(root, posix.slice(1)).replace(/\\/g, "/")
  }
  return resolved
}

export function shouldTransformFile(id: string, state: PluginState): boolean {
  // Fast exclusions
  if (
    id[0] === "\0" ||
    id.startsWith("vite:") ||
    id.includes("/node_modules/")
  ) {
    return false
  }

  const filePath = normalizeModulePath(id, state.projectRoot)
  const isIncludedByUser = state.includedPaths.some((p) =>
    filePath.startsWith(p)
  )
  const isWithinProject = filePath.startsWith(state.projectRoot)

  return (
    (isWithinProject || isIncludedByUser) &&
    TRANSFORMABLE_EXTENSIONS.has(path.extname(filePath))
  )
}
