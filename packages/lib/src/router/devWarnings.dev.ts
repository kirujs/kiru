import { __KIRU_PURE_CLIENT__, isBrowser } from "../env.js"

const warned = new Set<string>()

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  // eslint-disable-next-line no-console
  console.warn(`[kiru] ${message}`)
}

export const SERVER_LOADER_PURE_CLIENT_DEV_MSG =
  "`serverLoader` is not supported with `kiru/router/csr` or `kiru/router/ssg`. Use `kiru/router/ssr` with `createRenderer` and a server that handles `/?loader=` POSTs, or use `loader`, `clientLoader`, or `staticLoader`."

export const SERVER_LOADER_NO_RPC_DEV_MSG =
  "`serverLoader` ran on the client without `/?loader=` RPC (`__kiru_loaders`). Wire `router.serverEntry` in vite-plugin-kiru and run a server that registers the loader handler."

export const REMOTE_ACTION_PURE_CLIENT_DEV_MSG =
  'Remote `action` (including `action({ type: "form", … })`) require SSR with `createRenderer` and `actions.secret`. Pure CSR/SSG apps cannot invoke server actions.'

export function warnRouterViewWithoutSsrBootstrap(): void {
  if (!isBrowser || !__KIRU_PURE_CLIENT__) return
  const hasPageData = document.querySelector("script[k-page-data]")
  const hasRequestContext = document.querySelector("script[k-request-context]")
  if (!hasPageData && !hasRequestContext) return
  warnOnce(
    "router-view-ssr-bootstrap",
    "This document looks like SSR/SSG output, but the app was mounted with `createRouterApp` from `kiru/router/csr`. Use `kiru/router/ssr` or `kiru/router/ssg` so loader data and request context hydrate correctly."
  )
}

export function warnStaticLoaderOnClientNavigation(): void {
  if (!isBrowser) return
  warnOnce(
    "static-loader-csr-navigation",
    "`staticLoader` does not run on client navigations. Use SSR/SSG for the first paint, or use `loader` / `clientLoader` for CSR-only apps."
  )
}
