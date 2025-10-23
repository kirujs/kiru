import { AsyncTaskState } from "../types.utils"
import { FileRouterDataLoadError } from "./errors"

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
   * <FileRouter pages={import.meta.glob("...")} />
   * ```
   */
  pages: Record<string, unknown>
  /**
   * The import map to use for loading layouts
   * @example
   * ```tsx
   * <FileRouter layouts={import.meta.glob("...")} />
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
}

export interface RouteParams {
  [key: string]: string
}

export interface RouteQuery {
  [key: string]: string | string[] | undefined
}

export interface RouterState {
  path: string
  params: RouteParams
  query: RouteQuery
  signal: AbortSignal
}

type PageDataLoaderContext = RouterState & {}

export interface PageDataLoaderConfig<T = unknown> {
  load: (context: PageDataLoaderContext) => Promise<T>
  transition?: boolean
}

export interface PageConfig {
  loader?: PageDataLoaderConfig
  // title?: string
  // description?: string
  // meta?: Record<string, string>
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
