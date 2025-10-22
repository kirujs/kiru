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

export interface PageConfig {
  // title?: string
  // description?: string
  // meta?: Record<string, string>
}
