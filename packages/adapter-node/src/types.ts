import type { CustomRequestContext } from "kiru/router"

export type {
  KiruFetch,
  KiruHandle,
  KiruMiddleware,
  KiruRespondMiddleware,
  KiruResponder,
  ToFetchHandlerOptions,
} from "@kirujs/adapter-contract"

export type GetRequestContext = (
  request: Request
) => CustomRequestContext | Promise<CustomRequestContext>
