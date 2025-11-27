import path from "node:path"
import fs from "node:fs"
import { VIRTUAL_ENTRY_SERVER_ID } from "./virtual-modules.js"
import type { ViteDevServer, Manifest } from "vite"

type ServerEntryModule = typeof import("virtual:kiru:entry-server")
interface Global {
  viteDevServer: ViteDevServer | null
  serverEntryModule: ServerEntryModule | null
}

const $KIRU_HEADLESS_GLOBAL = Symbol.for("kiru.headlessGlobal")

// @ts-ignore
const global: Global = (globalThis[$KIRU_HEADLESS_GLOBAL] ??= {
  viteDevServer: null,
  server: null,
})

export const VITE_DEV_SERVER_INSTANCE = {
  get current() {
    return global.viteDevServer
  },
  set current(server) {
    global.viteDevServer = server
  },
}

let entryServerResolvers: ((serverEntry: ServerEntryModule) => void)[] = []
export const KIRU_SERVER_ENTRY_MODULE = {
  get current() {
    return global.serverEntryModule
  },
  set current(server) {
    global.serverEntryModule = server
    if (server) {
      entryServerResolvers.forEach((fn) => fn(server))
      entryServerResolvers = []
    }
  },
}

export async function getServerEntryModule(): Promise<ServerEntryModule> {
  if (KIRU_SERVER_ENTRY_MODULE.current) {
    return Promise.resolve(KIRU_SERVER_ENTRY_MODULE.current)
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

    entryServerResolvers.push(resolveWrapper)

    const timeout = setTimeout(() => {
      entryServerResolvers = entryServerResolvers.filter(
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
  const { render, documentModuleId } = await import(/* @vite-ignore */ fileUrl)

  if (typeof render !== "function" || typeof documentModuleId !== "string") {
    throw new Error(
      "Virtual entry server module does not export render and documentModuleId"
    )
  }

  return (KIRU_SERVER_ENTRY_MODULE.current = { render, documentModuleId })
}
