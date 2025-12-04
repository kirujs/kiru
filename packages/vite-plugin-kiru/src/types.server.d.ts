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

export interface ServerActionsMap {
  [key: string]: () => Promise<unknown>
}

export declare function renderPage(
  options: ServerRenderOptions
): Promise<SSRRenderResult>

export type ServerActionHttpResponse =
  | {
      body: string
      statusCode: 200
    }
  | {
      body: null
      statusCode: 500
    }

export interface ServerActionResponse {
  httpResponse: ServerActionHttpResponse | null
}

export declare function getServerActionResponse(
  request: Request
): Promise<ServerActionResponse>

export declare function getRequestContext(): Kiru.RequestContext
