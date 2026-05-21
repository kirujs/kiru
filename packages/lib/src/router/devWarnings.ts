import { __DEV__, isBrowser } from "../env.js"

const warned = new Set<string>()

export type RouterBootstrapMode = "csr" | "ssg" | "ssr"

export function warnOnce(key: string, message: string): void {
  if (!__DEV__) return
  if (warned.has(key)) return
  warned.add(key)
  // eslint-disable-next-line no-console
  console.warn(`[kiru] ${message}`)
}

const BOOTSTRAP_MODE_KEY = "__kiru_routerBootstrap"

export function markRouterBootstrap(mode: RouterBootstrapMode): void {
  ;(globalThis as Record<string, unknown>)[BOOTSTRAP_MODE_KEY] = mode
}

export function getRouterBootstrapMode(): RouterBootstrapMode | undefined {
  return (globalThis as Record<string, unknown>)[
    BOOTSTRAP_MODE_KEY
  ] as RouterBootstrapMode | undefined
}

export function warnRouterViewWithoutSsrBootstrap(): void {
  if (!isBrowser || !__DEV__) return
  const mode = getRouterBootstrapMode()
  if (mode === "ssr" || mode === "ssg") return
  const hasPageData = document.querySelector("script[k-page-data]")
  const hasRequestContext = document.querySelector("script[k-request-context]")
  if (!hasPageData && !hasRequestContext) return
  warnOnce(
    "router-view-ssr-bootstrap",
    "This document looks like SSR/SSG output, but the app was mounted with `createRouterApp` from `kiru/router/csr`. Use `kiru/router/ssr` or `kiru/router/ssg` so loader data and request context hydrate correctly."
  )
}

function hasLoaderRpcClient(): boolean {
  return !!(globalThis as Record<string, unknown>).__kiru_loaders
}

const SERVER_LOADER_PURE_CLIENT_MSG =
  "`serverLoader` is not supported with `kiru/router/csr` or `kiru/router/ssg`. Use `kiru/router/ssr` with `createRenderer` and a server that handles `/?loader=` POSTs, or use `loader`, `clientLoader`, or `staticLoader`."

const SERVER_LOADER_NO_RPC_MSG =
  "`serverLoader` ran on the client without `/?loader=` RPC (`__kiru_loaders`). Wire `router.serverEntry` in vite-plugin-kiru and run a server that registers the loader handler."

/** @throws when `serverLoader` cannot run on this client bootstrap. */
export function guardServerLoaderOnClient(): void {
  if (typeof window === "undefined" && typeof document === "undefined") {
    return
  }
  const mode = getRouterBootstrapMode()
  if (mode === "csr" || mode === "ssg") {
    warnOnce("server-loader-pure-client", SERVER_LOADER_PURE_CLIENT_MSG)
    throw new Error(`[kiru] ${SERVER_LOADER_PURE_CLIENT_MSG}`)
  }
  if (mode === "ssr" && !hasLoaderRpcClient()) {
    warnOnce("server-loader-without-rpc", SERVER_LOADER_NO_RPC_MSG)
  }
}

export function warnStaticLoaderOnClientNavigation(): void {
  if (!isBrowser || !__DEV__) return
  warnOnce(
    "static-loader-csr-navigation",
    "`staticLoader` does not run on client navigations. Use SSR/SSG for the first paint, or use `loader` / `clientLoader` for CSR-only apps."
  )
}

const REMOTE_ACTION_PURE_CLIENT_MSG =
  "Remote `action` (including `action.post({ type: \"form\" }, …)`) require SSR with `createRenderer` and `actions.secret`. Pure CSR/SSG apps cannot invoke server actions."

/** @throws when remote actions cannot run on this client bootstrap. */
export function guardRemoteActionOnClient(): void {
  if (typeof window === "undefined") return
  const mode = getRouterBootstrapMode()
  if (mode === "csr" || mode === "ssg") {
    warnOnce("remote-action-pure-client", REMOTE_ACTION_PURE_CLIENT_MSG)
    throw new Error(`[kiru] ${REMOTE_ACTION_PURE_CLIENT_MSG}`)
  }
}
