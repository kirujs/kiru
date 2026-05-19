import fs from "node:fs"
import path from "node:path"
import type { ResolvedConfig } from "vite"
import type { PluginState } from "./config.js"

/** Absolute directory Vite preview should serve (prerendered HTML + client assets). */
export function resolvePreviewClientDir(
  config: ResolvedConfig,
  state: PluginState
): string {
  const root = config.root
  const configured = path.resolve(root, config.build.outDir)
  if (state.router.serverEntry) {
    const normalized = configured.replace(/\\/g, "/")
    if (normalized.endsWith("/client")) return configured
    const nestedClient = path.join(configured, "client")
    if (fs.existsSync(nestedClient)) return nestedClient
  }
  return configured
}

/** Built SSR server entry next to `dist/client` (hybrid / SSR apps). */
export function resolvePreviewServerEntry(clientDir: string): string {
  return path.join(path.dirname(clientDir), "server", "index.js")
}

export function previewServerBundleExists(clientDir: string): boolean {
  return fs.existsSync(resolvePreviewServerEntry(clientDir))
}
