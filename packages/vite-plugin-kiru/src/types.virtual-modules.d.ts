declare module "virtual:kiru:entry-server" {
  export const render: (
    url: string,
    options: {
      userContext: Kiru.RequestContext
      registerModule: (moduleId: string) => void
    }
  ) => Promise<{ httpResponse: SSRHttpResponse | null }>
}
