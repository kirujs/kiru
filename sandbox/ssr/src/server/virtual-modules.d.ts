declare module "virtual:kiru:entry-server" {
  import { type Readable } from "node:stream"
  export interface SSRHttpResponse {
    html: string
    statusCode: number
    headers: Array<[string, string]>
    stream?: Readable
  }

  export interface SSRRenderResult {
    httpResponse: SSRHttpResponse | null
  }

  export function render(
    url: string,
    ctx?: {
      registerModule?: (moduleId: string) => void
    }
  ): Promise<SSRRenderResult>
}
