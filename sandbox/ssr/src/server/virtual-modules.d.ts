declare module "virtual:kiru:entry-server" {
  export interface SSRHttpResponse {
    html: string
    statusCode: number
    headers: Array<[string, string]>
    stream?: {
      onData: (callback: (chunk: string) => void) => void
      onFinished: (callback: () => void) => void
    }
  }

  export function render(
    url: string,
    ctx?: {
      registerModule?: (moduleId: string) => void
    }
  ): Promise<SSRHttpResponse>
}
