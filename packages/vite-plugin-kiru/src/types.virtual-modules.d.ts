declare module "virtual:kiru:entry-server" {
  export const render: (
    url: string,
    options: {
      registerModule: (moduleId: string) => void
    }
  ) => Promise<{ httpResponse: SSRHttpResponse | null }>
}
