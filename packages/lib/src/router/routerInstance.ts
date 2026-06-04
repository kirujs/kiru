import type { Signal } from "../signals/base.js"
import type {
  AfterEachHook,
  CurrentNavigation,
  CustomRequestContext,
  NavigationResult,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import type { RouterI18nFields } from "./i18n/augmentation.js"
import type { RouteTreeMatchSegment } from "./navigation.js"
import type { RouterQuery } from "./requestUrl.js"
import type {
  InterceptorHandle,
  InterceptorOptions,
  NavigatePath,
  RouterNavigateCallOptions,
  RouterNavigateInput,
} from "./routePaths.js"
import type { RouteInterceptState } from "./types.js"

export type RouterNavigationMode = "history" | "static"

/** CSR router instance; locale APIs require i18n via module augmentation. */
export interface RouterCore {
  manifest: RouteManifest
  pathname: Signal<string>
  params: Signal<Record<string, string>>
  hash: Signal<string>
  query: Signal<RouterQuery>
  baseUrl: string
  path: Signal<string>
  match: Signal<RouteMatch | null>
  matches: Signal<RouteTreeMatchSegment[]>
  navigate: (
    to: RouterNavigateInput,
    replaceOrOptions?: boolean | RouterNavigateCallOptions
  ) => Promise<NavigationResult>
  setQuery: (
    query: RouterQuery,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  setHash: (
    hash: string,
    options?: { replace?: boolean }
  ) => Promise<NavigationResult>
  resolveHref: (
    to: RouterNavigateInput,
    options?: {
      locale?: import("./i18n/augmentation.js").RouterLocaleParam
      params?: Record<string, string | undefined>
    }
  ) => string
  localeRouting?: import("./i18n/localeRouting.js").I18nLocaleRouting
  navigationMode: RouterNavigationMode
  /** When true (default), append `<kiru-route-announcer>` to `document.body` and announce `document.title` after successful navigations. */
  navigationAnnouncer: boolean
  requestContext: Signal<CustomRequestContext>
  afterEach: (hook: AfterEachHook) => () => void
  isNavigating: Signal<boolean>
  currentNavigation: Signal<CurrentNavigation | null>
  loaderEpoch: Signal<number>
  forceLoaderReload: Signal<boolean>
  isLoaderPending: Signal<boolean>
  isLoaderStale: Signal<boolean>
  outletRenderError: Signal<Error | null>
  validatedQuery: Signal<unknown | null>
  validatedRouteParams: Signal<Record<string, unknown> | null>
  interceptState: Signal<RouteInterceptState | null>
  createInterceptor: <P extends NavigatePath>(
    target: P,
    options: InterceptorOptions<P>
  ) => InterceptorHandle
  invalidate: (options?: {
    current?: boolean
    routeIds?: string[]
  }) => Promise<void>
  back: () => void
  forward: () => void
  go: (delta: number) => void
  dispose: () => void
}

export type Router = RouterCore & RouterI18nFields
