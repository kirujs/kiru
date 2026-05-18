import type {
  CustomRequestContext,
  Renderer,
  StreamRenderer,
} from "kiru/router"

export type KiruFetch = (request: Request) => Promise<Response>

export type KiruMiddleware = (
  request: Request,
  next: () => Promise<Response>
) => Promise<Response>

export type KiruHandler = {
  fetch: KiruFetch
  renderer: Renderer | StreamRenderer
  clientDir: string
  htmlTemplate: string
}

export type GetRequestContext = (
  request: Request
) => CustomRequestContext | Promise<CustomRequestContext>
