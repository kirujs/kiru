import { AsyncTaskState } from "../types.utils"
import { FileRouterDataLoadError } from "./errors"
import {
  DefaultComponentModule,
  FormattedViteImportMap,
} from "./types.internal"

export interface FileRouterPreloadConfig {
  pages: FormattedViteImportMap
  layouts: FormattedViteImportMap
  page: DefaultComponentModule
  pageProps: Record<string, unknown>
  pageLayouts: DefaultComponentModule[]
  config?: PageConfig
  params: RouteParams
  query: RouteQuery
  route: string
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
   * the element to use for hydration
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
   * The current path
   */
  path: string
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

type PageDataLoaderContext = RouterState & {}

export type PageDataLoaderConfig<T = unknown> = {
  /**
   * The function to load the page data
   */
  load: (context: PageDataLoaderContext) => Promise<T>
  /**
   * Enable transitions when swapping between "load", "error" and "data" states
   */
  transition?: boolean
} & (
  | {
      mode: "client"
      /**
       * The cache time for the page data loader
       */
      cache?: number
    }
  | {
      mode?: "build"
      cache?: never
    }
  | {
      mode?: never
      cache?: never
    }
)

export type PageConfig = {
  /**
   * The loader configuration for this page
   */
  loader?: PageDataLoaderConfig
  title?: string
  description?: string
  meta?: Record<string, string>
  generateStaticParams?: () => RouteParams[] | Promise<RouteParams[]>
}

export type PageProps<T extends PageConfig> =
  T["loader"] extends PageDataLoaderConfig
    ? AsyncTaskState<
        Awaited<ReturnType<T["loader"]["load"]>>,
        FileRouterDataLoadError
      >
    : {}

export interface ErrorPageProps {
  source?: {
    path: string
  }
}
