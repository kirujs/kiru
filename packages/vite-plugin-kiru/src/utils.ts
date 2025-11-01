import path from "node:path"
import fs from "node:fs"
import type { PluginState } from "./config.js"
import { ANSI } from "./ansi.js"

export function createLogger(state: PluginState) {
  return (...data: any[]) => {
    if (!state.loggingEnabled) return
    console.log(ANSI.cyan("[vite-plugin-kiru]"), ...data)
  }
}

export function resolveUserDocument(state: PluginState): string {
  const { dir, document } = state.appOptions
  const fp = path.resolve(state.projectRoot, dir, document)
  if (fs.existsSync(fp)) return fp.replace(/\\/g, "/")
  throw new Error(`Document not found at ${fp}`)
}

export function shouldTransformFile(id: string, state: PluginState): boolean {
  if (
    id.startsWith("\0") ||
    id.startsWith("vite:") ||
    id.includes("/node_modules/")
  ) {
    return false
  }

  if (!/\.[cm]?[jt]sx?$/.test(id)) {
    return false
  }

  const filePath = path.resolve(id).replace(/\\/g, "/")
  const isIncludedByUser = state.includedPaths.some((p) =>
    filePath.startsWith(p)
  )

  return isIncludedByUser || filePath.startsWith(state.projectRoot)
}
