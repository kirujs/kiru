import {
  createKiruHandler,
  type CreateKiruHandlerOptions,
  type KiruFetch,
  type KiruHandler,
} from "@kirujs/adapter-node"

declare const Bun: {
  serve(options: {
    port?: number
    fetch: KiruFetch
  }): { port: number }
}

export {
  composeFetch,
  createKiruHandler,
  diskPrerenderCache,
  resolveStatic,
  serveStaticFile,
  type CreateKiruHandlerOptions,
  type GetRequestContext,
  type KiruFetch,
  type KiruHandler,
  type KiruMiddleware,
  type ResolveSsrPathsOptions,
  type SsrPaths,
} from "@kirujs/adapter-node"

export type CreateKiruBunServerOptions = Omit<
  CreateKiruHandlerOptions,
  "deployTarget"
>

/**
 * Bun SSR server — same handler as Node; use with `Bun.serve` or {@link serveKiruBun}.
 */
export function createKiruBunServer(
  options: CreateKiruBunServerOptions
): KiruHandler {
  return createKiruHandler({ ...options, deployTarget: "bun" })
}

export function serveKiruBun(
  handler: KiruHandler | KiruFetch,
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
