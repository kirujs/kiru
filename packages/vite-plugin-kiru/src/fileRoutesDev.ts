import path from "node:path"
import { writeGeneratedRoutes } from "./fileRoutesCodegen.js"
import type { PluginState } from "./config.js"
import type { ResolvedFileRoutes } from "./fileRoutesConfig.js"
import { toViteModuleId } from "./resolveModulePattern.js"
import type { ViteDevServer } from "vite"

let fileRoutesDebounce: ReturnType<typeof setTimeout> | undefined
let debounceMs = 50

/** @internal Test hook — default 50ms in dev. */
export function setFileRoutesDebounceMs(ms: number): void {
  debounceMs = ms
}

/** @internal Clears pending debounced regen between tests. */
export function resetFileRoutesDebounce(): void {
  if (fileRoutesDebounce) clearTimeout(fileRoutesDebounce)
  fileRoutesDebounce = undefined
}

export function shouldRegenerateFileRoutes(
  normalizedPath: string,
  fr: ResolvedFileRoutes
): boolean {
  if (normalizedPath.startsWith(fr.pagesDirAbs)) return true
  if (fr.extendAbs !== undefined && normalizedPath === fr.extendAbs) return true
  return false
}

export async function regenerateFileRoutes(
  state: PluginState,
  server?: ViteDevServer,
  log?: (msg: string) => void
): Promise<void> {
  const fr = state.router.fileRoutes
  if (!fr) return
  try {
    const { written, outFileAbs } = await writeGeneratedRoutes(fr)
    if (!server) return
    if (!written) return
    const viteId = toViteModuleId(outFileAbs, state.projectRoot)
    const mod = server.moduleGraph.getModuleById(viteId)
    if (mod) server.moduleGraph.invalidateModule(mod)
    log?.(
      `\x1b[32m✓\x1b[0m routes regenerated (${path.relative(state.projectRoot, outFileAbs)})`
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`[vite-plugin-kiru]: file-routes codegen failed: ${msg}`)
  }
}

export function scheduleFileRoutesRegen(
  state: PluginState,
  server: ViteDevServer,
  log?: (msg: string) => void
): void {
  if (fileRoutesDebounce) clearTimeout(fileRoutesDebounce)
  fileRoutesDebounce = setTimeout(() => {
    fileRoutesDebounce = undefined
    void regenerateFileRoutes(state, server, log)
  }, debounceMs)
}

/** Dev server: initial codegen + watch `pagesDir` and optional `extend` module. */
export async function attachFileRoutesDevWatcher(
  state: PluginState,
  server: ViteDevServer,
  log?: (msg: string) => void
): Promise<void> {
  const fr = state.router.fileRoutes
  if (!fr) return

  await regenerateFileRoutes(state, server, log)
  server.watcher.add(fr.pagesDirAbs)
  if (fr.extendAbs) server.watcher.add(fr.extendAbs)

  server.watcher.on("all", (event, file) => {
    if (event !== "add" && event !== "change" && event !== "unlink") return
    const normalized = file.replace(/\\/g, "/")
    if (!shouldRegenerateFileRoutes(normalized, fr)) return
    scheduleFileRoutesRegen(state, server, log)
  })
}
