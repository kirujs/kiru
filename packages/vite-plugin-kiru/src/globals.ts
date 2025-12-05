import path from "node:path"
import fs from "node:fs"
import { VIRTUAL_ENTRY_SERVER_ID } from "./virtual-modules.js"
import type { ViteDevServer, Manifest } from "vite"

type ServerEntryModule = typeof import("virtual:kiru:entry-server")
interface KiruGlobal {
  viteDevServer: ViteDevServer | null
  serverEntryModule: ServerEntryModule | null
  serverEntryResolvers: ((serverEntry: ServerEntryModule) => void)[]
  rpcSecret: string | null
  route: string | null
}

const $KIRU_SERVER_GLOBAL = Symbol.for("kiru.serverGlobal")

// @ts-ignore
export const KIRU_SERVER_GLOBAL: KiruGlobal = (globalThis[
  $KIRU_SERVER_GLOBAL
] ??= {
  viteDevServer: null,
  server: null,
  serverEntryResolvers: [],
  rpcSecret: null,
  route: null,
})

export function setServerEntryModule(server: ServerEntryModule) {
  KIRU_SERVER_GLOBAL.serverEntryModule = server
  KIRU_SERVER_GLOBAL.serverEntryResolvers.forEach((fn) => fn(server))
  KIRU_SERVER_GLOBAL.serverEntryResolvers.length = 0
}

export async function getServerEntryModule(): Promise<ServerEntryModule> {
  if (KIRU_SERVER_GLOBAL.serverEntryModule) {
    return Promise.resolve(KIRU_SERVER_GLOBAL.serverEntryModule)
  }
  if (process.env.NODE_ENV !== "production") {
    // gets set in dev mode by the plugin
    return getServerEntryModule_Dev()
  }
  // load server entry module via import()
  return getServerEntryModule_Production()
}

async function getServerEntryModule_Dev(): Promise<ServerEntryModule> {
  return new Promise((resolve, reject) => {
    const resolveWrapper = (server: ServerEntryModule) => {
      clearTimeout(timeout)
      resolve(server)
    }

    KIRU_SERVER_GLOBAL.serverEntryResolvers.push(resolveWrapper)

    const timeout = setTimeout(() => {
      KIRU_SERVER_GLOBAL.serverEntryResolvers =
        KIRU_SERVER_GLOBAL.serverEntryResolvers.filter(
          (r) => r !== resolveWrapper
        )
      reject(new Error("Failed to acquire server renderer. Seek help!"))
    }, 10_000)
  })
}

async function getServerEntryModule_Production(): Promise<ServerEntryModule> {
  const projectRoot = process.cwd().replace(/\\/g, "/")
  const serverOutDirAbs = path.resolve(projectRoot, "dist/server")
  const manifestPath = path.resolve(serverOutDirAbs, "vite-manifest.json")

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

  return (KIRU_SERVER_GLOBAL.serverEntryModule = mod)
}
