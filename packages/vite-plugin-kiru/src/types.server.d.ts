import type { Readable } from "stream"

export interface SSRHttpResponse {
  html: string
  statusCode: number
  headers: Array<[string, string]>
  stream: Readable | null
}

export interface SSRRenderResult {
  httpResponse: SSRHttpResponse | null
}

export interface ServerRenderOptions {
  url: string
}

export declare function renderPage(
  options: ServerRenderOptions
): Promise<SSRRenderResult>
