/** Kiru handled the request. Convert with {@link toWebResponse} or {@link sendKiruResponse} (Node). */
export type KiruResponse = {
  status: number
  headers: HeadersInit
  body: string | ReadableStream
}

/** `null` — Kiru did not handle the request (pass through, 404, or other framework route). */
export type KiruHandle = (
  request: Request
) => Promise<KiruResponse | null>

export type KiruFetch = (request: Request) => Promise<Response>

export type KiruRespondMiddleware = (
  request: Request,
  next: () => Promise<KiruResponse | null>
) => Promise<KiruResponse | null>

/** Runtime-produced app: {@link KiruHandle} plus optional Web `fetch` adapter. */
export type KiruResponder = {
  handle: KiruHandle
  /** `handle` with `null` mapped to 404 (or custom) — for `Bun.serve` / `export default { fetch }`. */
  fetch: KiruFetch
  renderer: unknown
  clientDir: string
  htmlTemplate: string
}

/** @deprecated Use {@link KiruResponder}. */
export type KiruHandler = KiruResponder

export type KiruMiddleware = KiruRespondMiddleware

export function resolveKiruHandle(
  target: KiruResponder | KiruHandle
): KiruHandle {
  return typeof target === "function" ? target : target.handle.bind(target)
}

/** @deprecated Use {@link resolveKiruHandle}. */
export function resolveKiruFetch(handler: KiruResponder | KiruFetch): KiruFetch {
  return typeof handler === "function"
    ? handler
    : handler.fetch.bind(handler)
}

export function toWebResponse(kiru: KiruResponse): Response {
  return new Response(kiru.body as BodyInit, {
    status: kiru.status,
    headers: kiru.headers,
  })
}

export type ToFetchHandlerOptions = {
  /** When `handle` returns `null`. Default: 404 plain text. */
  notFound?: Response | (() => Response | Promise<Response>)
}

/** Wrap {@link KiruHandle} as a Web `fetch` handler (`null` → `notFound`). */
export function toFetchHandler(
  handle: KiruHandle,
  options?: ToFetchHandlerOptions
): KiruFetch {
  const notFound =
    options?.notFound ??
    (() => new Response("Not Found", { status: 404 }))
  return async (request) => {
    const kiru = await handle(request)
    if (kiru === null) {
      return typeof notFound === "function" ? await notFound() : notFound
    }
    return toWebResponse(kiru)
  }
}

/** Compose middleware around a terminal {@link KiruHandle} (outermost first). */
export function composeRespond(
  terminal: KiruHandle,
  ...layers: KiruRespondMiddleware[]
): KiruHandle {
  return layers.reduceRight<KiruHandle>(
    (next, layer) => (request) => layer(request, () => next(request)),
    terminal
  )
}

export async function webResponseToKiru(
  response: Response
): Promise<KiruResponse> {
  return {
    status: response.status,
    headers: response.headers,
    body: response.body ?? (await response.text()),
  }
}

/** Close over Worker `env` / `ctx` for fetch-native frameworks. */
export function asKiruHandle(
  worker: (
    request: Request,
    env?: unknown,
    ctx?: unknown
  ) => Promise<KiruResponse | null>,
  bindings: { env?: unknown; ctx?: unknown }
): KiruHandle {
  return (request) => worker(request, bindings.env, bindings.ctx)
}
