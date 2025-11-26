import type { AsyncTaskState } from "../types.utils"
import type { FileRouterDataLoadError } from "./errors"
import type {
  DefaultComponentModule,
  FormattedViteImportMap,
  GuardModule,
  PageModule,
} from "./types.internal"

export interface FileRouterPreloadConfig {
  pages: FormattedViteImportMap<PageModule>
  layouts: FormattedViteImportMap
  guards?: FormattedViteImportMap<GuardModule>
  page: PageModule
  pageProps: Record<string, unknown>
  pageLayouts: DefaultComponentModule[]
  params: RouteParams
  query: RouteQuery
  route: string
  cacheData: null | { value: unknown }
}

export interface FileRouterConfig {
  /**
   * The directory to load routes from
   * @default "/pages"
   */
  dir?: string
  /**
   * The import map to use for loading pages
   * @example
   * ```tsx
   * <FileRouter config={{ pages: import.meta.glob("/∗∗/index.tsx"), ... }} />
   * ```
   */
  pages: Record<string, unknown>
  /**
   * The import map to use for loading layouts
   * @example
   * ```tsx
   * <FileRouter config={{ pages: import.meta.glob("/∗∗/layout.tsx"), ... }} />
   * ```
   */
  layouts: Record<string, unknown>
  /**
   * The import map to use for loading nav guards
   * @example
   * ```tsx
   * <FileRouter config={{ guards: import.meta.glob("/∗∗/guard.{ts,js}"), ... }} />
   * ```
   */
  guards?: Record<string, unknown>

  /**
   * The base url to use as a prefix for route matching
   * @default "/"
   */
  baseUrl?: string

  /**
   * Enable transitions for all routes and loading states
   * @default false
   */
  transition?: boolean

  /**
   * Used for generated entry point files
   * @internal
   */
  preloaded?: FileRouterPreloadConfig
}

export interface RouteParams {
  [key: string]: string
}

export interface RouteQuery {
  [key: string]: string | string[] | undefined
}

export interface RouterState {
  /**
   * The current pathname
   * @example
   * "/users/[id]" -> "/users/123"
   */
  pathname: string
  /**
   * The current hash
   * @example
   * "/users/123#profile" -> "#profile"
   */
  hash: string
  /**
   * The current route params
   * @example
   * "/foo/[id]/page.tsx" -> { id: "123" }
   */
  params: RouteParams
  /**
   * The current route query
   */
  query: RouteQuery
  /**
   * The abort signal for the current route, aborted and
   * renewed each time the route changes or reloads
   */
  signal: AbortSignal
}

export interface PageDataLoaderCacheConfig {
  type: "memory" | "localStorage" | "sessionStorage"
  ttl: number
}

interface LoaderContext extends RouterState {
  /**
   * The request context - in SSR, this is the data from the server
   * that's passed to the `renderPage` function
   * @example
   * ```ts
   * // server.ts
   * renderPage({ url, context: { test: 123 } })
   *
   * // page.tsx
   * loader: {
   *   load: ({ context }) => context.test
   * }
   * ```
   */
  context: Kiru.RequestContext
}

export type PageDataLoaderConfig<T = unknown> = {
  /**
   * The function to load the page data
   */
  load: (context: LoaderContext) => Promise<T>
} & (
  | {
      /**
       * The mode to use for the page data loader
       * @default "client"
       * @description
       * - **static**: The page data is loaded at build time and never updated
       * - **client**: The page data is loaded upon navigation and updated on subsequent navigations
       */
      mode?: "client"
      /**
       * Enable transitions when swapping between "load", "error" and "data" states
       */
      transition?: boolean

      /**
       * Configure caching for this loader
       * @example
       * ```ts
       * cache: {
       *   type: "memory", // or "localStorage" / "sessionStorage"
       *   ttl: 1000 * 60 * 5, // 5 minutes
       }
       * ```
       */
      cache?: PageDataLoaderCacheConfig
    }
  | {
      /**
       * The mode to use for the page data loader
       * @default "client"
       * @description
       * - **static**: The page data is loaded at build time and never updated
       * - **client**: The page data is loaded upon navigation and updated on subsequent navigations
       */
      mode: "static"
    }
)

export type NavigationHook<T> = (
  context: Kiru.RequestContext,
  to: string,
  from: string
) => T

export type OnBeforeEnterHook = NavigationHook<
  string | void | Promise<string | void>
>
export type OnBeforeLeaveHook = NavigationHook<false | void>

interface PageContextHooks {
  onBeforeEnter?: OnBeforeEnterHook | OnBeforeEnterHook[]
  onBeforeLeave?: OnBeforeLeaveHook | OnBeforeLeaveHook[]
}

export interface PageConfig<T = unknown> {
  /**
   * The loader configuration for this page
   */
  loader?: PageDataLoaderConfig<T>
  /**
   * Generate static params for this page. For each params
   * returned, a page will be generated
   */
  generateStaticParams?: () => RouteParams[] | Promise<RouteParams[]>

  hooks?: PageContextHooks
}

export type PageProps<T extends PageConfig<any>> = T extends PageConfig<infer U>
  ? AsyncTaskState<U, FileRouterDataLoadError>
  : {}
