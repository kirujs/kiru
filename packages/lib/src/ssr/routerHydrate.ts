import type { AppHandle, AppHandleOptions } from "../appHandle.js"
import { Fragment } from "../element.js"
import { createElement } from "../element.js"
import { hydrate } from "./client.js"
import { createRouter } from "../router/csr.js"
import { createSsrRouterShell } from "../router/routerShell.js"
import {
  buildInitialSsrOutletInShell,
  SsrClientOutlet,
} from "../router/ssrClientOutlet.js"
import { compileRouteTree } from "../router/manifest.js"
import type { RouteManifest, RouteTreeDefinition } from "../router/types.js"
import { ensureClientI18nReady } from "../router/i18nContext.js"
import { readHydratedRequestContext } from "../router/requestContext.js"
import { requestToken } from "../globals.js"
import { applyActionResponseHeaders } from "../router/routerGlobal.js"
import {
  isKiruRedirect,
  serializeActionCallQuery,
  type RemoteActionCallOptions,
} from "../remote/action.js"
import { buildActionRpcHeaders } from "../remote/actionRequestHeaders.js"
import { ActionDispatchError } from "../remote/errors.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { REMOTE_ACTION_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"
import { ensureLoaderClient } from "../router/loaderClient.js"
import { buildActionRpcUrl } from "../router/rpcUrl.js"
import { loadClientHydrationChunksManifest } from "../router/hydrationChunks.js"
import { getRouterInstanceRuntime } from "../router/routerRuntime.js"
import { ensureKiruRouterRuntime } from "../kiruRuntime.js"

type ServerActionsClient = {
  dispatch: (
    id: string,
    call?: RemoteActionCallOptions<unknown, Record<string, unknown>>
  ) => Promise<unknown>
}

function ensureServerActionsClient() {
  if (typeof window === "undefined") return
  const router = ensureKiruRouterRuntime()
  if (router.serverActions) return

  router.serverActions = {
    dispatch: async (id, call) => {
      if (__DEV__ && __KIRU_PURE_CLIENT__) {
        throw new ActionDispatchError(500, REMOTE_ACTION_PURE_CLIENT_DEV_MSG)
      }
      const callEnvelope = call ?? {}
      const headers = buildActionRpcHeaders(
        requestToken.current,
        callEnvelope.headers
      )
      const init: RequestInit = {
        method: "POST",
        signal: callEnvelope.signal,
        headers,
        body: JSON.stringify(
          callEnvelope.body === undefined ? null : callEnvelope.body
        ),
      }
      const queryString =
        callEnvelope.query && Object.keys(callEnvelope.query).length > 0
          ? serializeActionCallQuery(callEnvelope.query)
          : ""
      const r = await fetch(buildActionRpcUrl(id, undefined, queryString), init)
      applyActionResponseHeaders(r.headers)

      if (!r.ok) {
        throw new ActionDispatchError(r.status || 500, "Action failed")
      }

      const text = await r.text()
      if (!text) return undefined

      let data: unknown
      try {
        data = JSON.parse(text) as unknown
      } catch {
        throw new ActionDispatchError(500, "Invalid action response")
      }

      if (isKiruRedirect(data)) {
        window.location.assign(
          new URL((data as { location: string }).location, window.location.href)
            .href
        )
        return undefined
      }

      return data
    },
  }
}

export function __kiruEnsureRemoteDispatch(): ServerActionsClient["dispatch"] {
  ensureServerActionsClient()
  return ensureKiruRouterRuntime().serverActions!.dispatch
}

export {
  __kiruEnsureLoaderDispatch,
  ensureLoaderClient,
  getLoaderDispatch,
  isLoaderRpcAvailable,
} from "../router/loaderClient.js"

/**
 * Lower-level hydrate entry for SSR and SSG documents (`kiru/ssr/router`).
 * Prefer {@link createRouterApp} from `kiru/router/ssr` or `kiru/router/ssg` unless you
 * need direct control over {@link bootstrapSsrClient} / {@link bootstrapSsgClient}.
 *
 * @see docs/router/route-middleware-and-context.md
 */
export type BootstrapSsrClientOptions = {
  /** Route tree from {@link createRouteTree} or a precompiled {@link RouteManifest}. */
  routes: RouteTreeDefinition | RouteManifest
  /** DOM element that receives the hydrated router outlet. */
  container: HTMLElement
  /**
   * Options for {@link mount}. `hydrationMode`: `"static"` (SSG) or `"dynamic"` (SSR).
   * `kiru/router/ssr` sets `"dynamic"`; `kiru/router/ssg` sets `"static"`.
   */
  hydrateOptions?: AppHandleOptions & {
    hydrationMode?: "static" | "dynamic"
  }
  /**
   * Client i18n bundles; should match {@link createRenderer} / prerender locale config.
   */
  i18n?: import("../router/i18n/index.js").InternationalizationConfig<
    readonly string[],
    unknown
  >
  /** When false, omit `<kiru-route-announcer>` on `document.body` (default true). */
  navigationAnnouncer?: boolean
}

/**
 * Fragments are not sent on HTTP requests, so SSR HTML matches `hash: ""`.
 * Clear the client router hash until after hydration to avoid text-node mismatches.
 */
function stashClientHashForSsrHydration(
  router: ReturnType<typeof createRouter>
): string {
  if (typeof window === "undefined") return ""
  const hash = window.location.hash
  if (hash) router.hash.value = ""
  return hash
}

function restoreClientHashAfterHydration(
  router: ReturnType<typeof createRouter>,
  hash: string
): void {
  if (hash) router.hash.value = hash
}

/**
 * Hydrate an SSR document from {@link createRenderer} / {@link fillRouteHtmlTemplate}.
 * Preloads the current route (same subtree as the server) and updates the tree on navigations.
 */
export async function bootstrapSsrClient(
  options: BootstrapSsrClientOptions
): Promise<AppHandle> {
  const chunksReady = loadClientHydrationChunksManifest()
  const manifest =
    "routes" in options.routes
      ? options.routes
      : compileRouteTree(options.routes)
  const { container, hydrateOptions, i18n, navigationAnnouncer } = options
  const router = createRouter({
    routes: manifest,
    i18n,
    navigationAnnouncer,
  })
  ensureLoaderClient()
  const i18nReady = ensureClientI18nReady(router)
  const pendingClientHash = stashClientHashForSsrHydration(router)

  const staticHydrate = {
    hydrationMode: "dynamic" as const,
    ...hydrateOptions,
  }

  const requestContext = readHydratedRequestContext()
  const match = router.match.peek()
  const outletReady = match
    ? i18nReady.then(() =>
        buildInitialSsrOutletInShell(router, manifest, requestContext)
      )
    : Promise.resolve(undefined)
  await Promise.all([chunksReady, i18nReady, outletReady])
  const initialSubtree = match ? await outletReady : undefined

  const app = hydrate(
    Fragment({
      children: createSsrRouterShell(
        router,
        requestContext,
        createElement(SsrClientOutlet, {
          manifest,
          ...(initialSubtree !== undefined ? { initialSubtree } : {}),
        }),
        undefined,
        getRouterInstanceRuntime(router).i18n?.runtime
      ),
    }),
    container,
    staticHydrate
  )

  restoreClientHashAfterHydration(router, pendingClientHash)

  return app
}

/**
 * Bootstrap an SSG document (static hydration) while preserving router navigation.
 */
export function bootstrapSsgClient(
  options: Omit<BootstrapSsrClientOptions, "hydrateOptions"> & {
    hydrateOptions?: AppHandleOptions
  }
): Promise<AppHandle> {
  return bootstrapSsrClient({
    ...options,
    hydrateOptions: {
      ...options.hydrateOptions,
      hydrationMode: "static",
    },
  })
}
