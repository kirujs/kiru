//https://vike.dev/pageContext#custom

declare global {
  namespace Vike {
    interface PageContext {
      abortReason?: string
      abortStatusCode?: number
      is404?: boolean

      config: {
        title: string | ((ctx: PageContext) => string)
        Page: Kiru.FC
        Layout: Kiru.FC[]
      }

      routeParams: Record<string, string>
      data: Record<string, unknown>
    }
  }
}

export {}
