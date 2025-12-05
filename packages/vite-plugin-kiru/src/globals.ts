import path from "node:path"
import fs from "node:fs"
import { VIRTUAL_ENTRY_SERVER_ID } from "./virtual-modules.js"
import type { ViteDevServer, Manifest } from "vite"

type ServerEntryModule = typeof import("virtual:kiru:entry-server")
interface KiruServerGlobal {
  viteDevServer: ViteDevServer | null
  serverEntryModule: PromiseWithResolvers<ServerEntryModule>
  route: string | null
  loadedRemoteModules: Map<string, Promise<unknown>>
}

const $KIRU_SERVER_GLOBAL = Symbol.for("kiru.server.global")
const projectRoot = process.cwd().replace(/\\/g, "/")
const serverOutDirAbs = path.resolve(projectRoot, "dist/server")
const manifestPath = path.resolve(serverOutDirAbs, "vite-manifest.json")

// @ts-ignore
const global: KiruServerGlobal = (globalThis[$KIRU_SERVER_GLOBAL] ??= {
  viteDevServer: null,
  serverEntryModule: Promise.withResolvers<ServerEntryModule>(),
  route: null,
  loadedRemoteModules: new Map(),
} satisfies KiruServerGlobal)

export { global as KIRU_SERVER_GLOBAL }

export async function loadRouteRemoteModule(route: string): Promise<unknown> {
  const existing = global.loadedRemoteModules.get(route)
  if (existing) return existing

  const {
    config: { remotes },
  } = await getServerEntryModule()

  const routeEntry = remotes[route]
  if (!routeEntry) {
    throw new Error(`Remote functions route not found: ${route}`)
  }

  const promise = remotes[route].load()
  global.loadedRemoteModules.set(route, promise)
  return promise
}

export function setServerEntryModule(server: ServerEntryModule) {
  global.serverEntryModule.resolve(server)
}

let serverEntryLoadInitialized = false
export async function getServerEntryModule(): Promise<ServerEntryModule> {
  if (process.env.NODE_ENV === "production" && !serverEntryLoadInitialized) {
    serverEntryLoadInitialized = true
    loadServerEntryModuleFromBuild()
  }

  return global.serverEntryModule.promise
}

async function loadServerEntryModuleFromBuild() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Server manifest not found at ${manifestPath}. Make sure the SSR build has been completed.`
    )
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  ) as Manifest

  // Find the virtual entry server module in the manifest
  // It should be keyed as "__virtual_kiru_entry-server-{hash}.js"
  const virtualEntryServerModule = Object.values(manifest).find(
    (value) => value.src === VIRTUAL_ENTRY_SERVER_ID
  )

  if (!virtualEntryServerModule) {
    throw new Error(
      "Virtual entry server module not found in manifest. Make sure the SSR build has been completed."
    )
  }

  const entryServerFile = virtualEntryServerModule.file
  const entryServerPath = path.resolve(serverOutDirAbs, entryServerFile)

  if (!fs.existsSync(entryServerPath)) {
    throw new Error(
      `Virtual entry server module file not found at ${entryServerPath}`
    )
  }

  // Import from the bundled file
  // Use file:// URL for ESM import
  const fileUrl = `file://${entryServerPath.replace(/\\/g, "/")}`
  const mod = await import(/* @vite-ignore */ fileUrl)
  global.serverEntryModule.resolve(mod)
}
