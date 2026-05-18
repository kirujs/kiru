import {
  createKiruResponder,
  type CreateKiruHandlerOptions,
  type KiruFetch,
  type KiruResponder,
} from "@kirujs/adapter-node"

declare const Bun: {
  serve(options: {
    port?: number
    fetch: KiruFetch
  }): { port: number }
}

export {
  composeRespond,
  createKiruHandler,
  createKiruResponder,
  diskPrerenderCache,
  nodeRequestToFetch,
  resolveStatic,
  sendFetchToNodeResponse,
  sendKiruResponse,
  serveStaticFile,
  toFetchHandler,
  toWebResponse,
  type CreateKiruHandlerOptions,
  type GetRequestContext,
  type KiruFetch,
  type KiruHandle,
  type KiruHandler,
  type KiruRespondMiddleware,
  type KiruResponder,
  type KiruResponse,
  type ResolveSsrPathsOptions,
  type SsrPaths,
  type ToFetchHandlerOptions,
} from "@kirujs/adapter-node"

export type CreateKiruBunServerOptions = Omit<
  CreateKiruHandlerOptions,
  "deployTarget"
>

/** Bun SSR — same {@link KiruResponder} as Node with `deployTarget: "bun"`. */
export function createKiruBunServer(
  options: CreateKiruBunServerOptions
): KiruResponder {
  return createKiruResponder({ ...options, deployTarget: "bun" })
}

export function serveKiruBun(
  handler: KiruResponder | KiruFetch,
  port = Number(process.env.PORT) || 3000
): ReturnType<typeof Bun.serve> {
  const fetch =
    typeof handler === "function" ? handler : handler.fetch.bind(handler)
  const server = Bun.serve({ port, fetch })
  console.log(
    `[@kirujs/adapter-bun] listening on http://localhost:${server.port}`
  )
  return server
}
