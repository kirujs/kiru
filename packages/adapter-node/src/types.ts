import type { CustomRequestContext } from "kiru/router"

export type {
  KiruFetch,
  KiruHandle,
  KiruHandler,
  KiruMiddleware,
  KiruRespondMiddleware,
  KiruResponder,
  KiruResponse,
  ToFetchHandlerOptions,
} from "@kirujs/adapter-contract"

export type GetRequestContext = (
  request: Request
) => CustomRequestContext | Promise<CustomRequestContext>
