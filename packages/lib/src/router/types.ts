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

export interface DefaultComponentModule {
  default: Kiru.FC
}

export interface ViteImportMap {
  [fp: string]: () => Promise<DefaultComponentModule>
}
