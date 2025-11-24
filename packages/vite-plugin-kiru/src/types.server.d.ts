export interface SSRHttpResponse {
  html: string
  statusCode: number
  headers: Array<[string, string]>
  stream: ReadableStream | null
}

export interface SSRRenderResult {
  httpResponse: SSRHttpResponse | null
}

export interface ServerRenderOptions {
  url: string
  context: Kiru.RequestContext
}

export declare function renderPage(
  options: ServerRenderOptions
): Promise<SSRRenderResult>
