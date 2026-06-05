import { requestToken } from "../globals.js"
import { ensureKiruRouterRuntime } from "../kiruRuntime.js"
import type { LoaderContext } from "./loaders.js"
import { serializeLoaderRpcContext } from "./loaderRpc.js"
import { buildLoaderRpcUrl } from "./rpcUrl.js"
import { seedQueriesFromPayload } from "../remote/pageDataQueries.js"

export type LoaderDispatch = (
  routeId: string,
  ctx: LoaderContext
) => Promise<unknown>

export function isLoaderRpcAvailable(): boolean {
  return !!ensureKiruRouterRuntime().loaders
}

export function ensureLoaderClient(): void {
  if (typeof window === "undefined") return
  const router = ensureKiruRouterRuntime()
  if (router.loaders) return
  router.loaders = {
    dispatch: async (routeId, context) => {
      const r = await fetch(buildLoaderRpcUrl(routeId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiru-token": requestToken.current,
        },
        body: JSON.stringify(serializeLoaderRpcContext(context)),
        signal: context.signal,
      })
      if (!r.ok) throw new Error("Loader request failed")
      const payload = await r.json()
      return seedQueriesFromPayload(payload)
    },
  }
}

export function getLoaderDispatch(): LoaderDispatch {
  ensureLoaderClient()
  return ensureKiruRouterRuntime().loaders!.dispatch
}

/** @internal Used by vite codegen for `serverLoader` client bundles. */
export function __kiruEnsureLoaderDispatch(): LoaderDispatch {
  return getLoaderDispatch()
}
