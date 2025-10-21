declare module "virtual:kiru-file-router-manifest" {
  const manifest: {
    routes: Array<{
      path: string
      filePath: string
      params: string[]
      layouts: Array<{
        path: string
        filePath: string
        level: number
      }>
    }>
  }
  export default manifest
}

declare module "virtual:kiru-file-router" {
  export const routeMap: Record<string, any>
  export const layoutMap: Record<string, any>
  export const routePaths: string[]
  export const routeInfo: Array<{
    path: string
    params: string[]
    layouts: Array<{
      path: string
      filePath: string
      level: number
    }>
  }>
}
