import type { ViteDevServer } from "vite"

type ServerEntry = typeof import("virtual:kiru:entry-server")
interface Global {
  viteDevServer: ViteDevServer | null
  serverEntry: ServerEntry | null
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
  set current(server: ViteDevServer | null) {
    global.viteDevServer = server
  },
}

let entryServerResolvers: (() => void)[] = []
export const KIRU_SERVER_ENTRY = {
  get current() {
    return global.serverEntry
  },
  set current(server: ServerEntry | null) {
    global.serverEntry = server
    if (server) {
      entryServerResolvers.forEach((fn) => fn())
      entryServerResolvers = []
    }
  },
}

export async function awaitServerRendererInitialized_Dev(): Promise<ServerEntry> {
  if (KIRU_SERVER_ENTRY.current) {
    return Promise.resolve(KIRU_SERVER_ENTRY.current)
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      entryServerResolvers = entryServerResolvers.filter((r) => r !== resolve)
      reject(new Error("Failed to acquire server renderer. Seek help!"))
    }, 10_000)

    entryServerResolvers.push(() => {
      clearTimeout(timeout)
      resolve(KIRU_SERVER_ENTRY.current!)
    })
  })
}
