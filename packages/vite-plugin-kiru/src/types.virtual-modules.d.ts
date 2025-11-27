declare module "virtual:kiru:entry-server" {
  export const documentModuleId: string
  export const render: (
    url: string,
    options: {
      userContext: Kiru.RequestContext
      registerModule: (moduleId: string) => void
    }
  ) => Promise<{ httpResponse: SSRHttpResponse | null }>
}

declare module "virtual:kiru:config" {
  export const dir: string
  export const baseUrl: string
  export const pages: Record<string, any>
  export const layouts: Record<string, any>
  export const guards: Record<string, any>
  export const transition: boolean
}

declare module "virtual:kiru:entry-client" {
  export const initClient: (options: {
    dir: string
    baseUrl: string
    pages: Record<string, any>
    layouts: Record<string, any>
    guards: Record<string, any>
    transition: boolean
  }) => void
}
