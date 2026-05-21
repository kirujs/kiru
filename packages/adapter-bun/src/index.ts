import {
  createKiruResponder,
  type CreateKiruHandlerOptions,
  type KiruResponder,
} from "@kirujs/adapter-node"

export {
  composeRespond,
  createKiruHandler,
  createKiruResponder,
  diskPrerenderCache,
  bindClientDisconnectAbort,
  nodeRequestToFetch,
  resolveStatic,
  writeNodeResponse,
  type NodeFetchRequest,
  serveStaticFile,
  toFetchHandler,
  toNodeListener,
  type CreateKiruHandlerOptions,
  type GetRequestContext,
  type KiruFetch,
  type KiruHandle,
  type KiruRespondMiddleware,
  type KiruResponder,
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
