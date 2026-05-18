import { Hono } from "hono"
import {
  createKiruHandler,
  type CreateKiruHandlerOptions,
} from "./createKiruHandler.js"
import type { KiruHandler } from "./types.js"

export type KiruHonoApp = KiruHandler & {
  /** Hono app forwarding every request to {@link KiruHandler.fetch}. */
  app: Hono
}

/** Hono app that forwards all routes to {@link createKiruHandler}. */
export function createKiruHono(
  options: CreateKiruHandlerOptions
): KiruHonoApp {
  const kiru = createKiruHandler(options)
  const app = new Hono()
  app.all("*", (c) => kiru.fetch(c.req.raw))
  return { ...kiru, app }
}
