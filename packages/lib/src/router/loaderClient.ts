import { requestToken } from "../globals.js"
import type { LoaderContext } from "./loaders.js"
import { buildLoaderRpcUrl } from "./rpcUrl.js"

export type LoaderDispatch = (
  routeId: string,
  ctx: LoaderContext
) => Promise<unknown>

export function isLoaderRpcAvailable(): boolean {
  return !!(globalThis as Record<string, unknown>).__kiru_loaders
}

export function ensureLoaderClient(): void {
  if (typeof window === "undefined") return
  const g = globalThis as typeof globalThis & {
    __kiru_loaders?: { dispatch: LoaderDispatch }
  }
  if (g.__kiru_loaders) return
  g.__kiru_loaders = {
    dispatch: async (routeId, context) => {
      const r = await fetch(buildLoaderRpcUrl(routeId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiru-token": requestToken.current,
          },
          body: JSON.stringify(context),
          signal: context.signal,
        }
      )
      if (!r.ok) throw new Error("Loader request failed")
      return r.json()
    },
  }
}

export function getLoaderDispatch(): LoaderDispatch {
  ensureLoaderClient()
  return (
    globalThis as typeof globalThis & {
      __kiru_loaders?: { dispatch: LoaderDispatch }
    }
  ).__kiru_loaders!.dispatch
}

/** @internal Used by vite codegen for `serverLoader` client bundles. */
export function __kiruEnsureLoaderDispatch(): LoaderDispatch {
  return getLoaderDispatch()
}
