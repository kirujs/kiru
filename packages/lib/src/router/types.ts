import { AsyncTaskState } from "../types.utils"
import { FileRouterDataLoadError } from "./errors"

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

export interface PageModule {
  default: Kiru.FC
  config?: PageConfig
}

export interface LayoutModule {
  default: Kiru.FC
}

export interface VitePagesImportMap {
  [fp: string]: () => Promise<PageModule>
}

export interface ViteLayoutsImportMap {
  [fp: string]: () => Promise<LayoutModule>
}

export interface LayoutInfo {
  path: string
  module: () => Promise<LayoutModule>
}

export type LayoutReducer = (
  state: RouterState,
  layouts: LayoutInfo[]
) => LayoutInfo[]

export type PageDataLoaderConfig<T = unknown> = {
  load: (signal: AbortSignal, state: RouterState) => Promise<T>
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
