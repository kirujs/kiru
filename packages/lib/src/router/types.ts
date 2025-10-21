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

export interface FileRouteInfo {
  path: string
  filePath: string
  params: string[]
  layouts: LayoutInfo[]
}

export interface LayoutInfo {
  path: string
  filePath: string
  level: number
}
