import "virtual:kiru:remote-registry"
import { createServer } from "node:http"
import { createKiruHandler, toNodeListener } from "@kirujs/adapter-node"
import { getUserFromRequest, type SandboxUser } from "./auth.js"
import { routes } from "../routes.js"

const isProd = process.env.NODE_ENV === "production"

declare module "kiru/router" {
  interface CustomRequestContext {
    user: SandboxUser | null
  }
}

const kiru = createKiruHandler({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: true,
  routes,
  actions: {
    secret: "sandbox-ssr-remote-secret",
    /** Wildcard keeps `pnpm dev` working regardless of host/port; tighten in production. */
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
  getRequestContext: async (request) => ({
    user: getUserFromRequest(request),
  }),
})

export default { fetch: kiru.fetch }

if (isProd) {
  const port = Number(process.env.PORT) || 5179
  createServer(toNodeListener(kiru)).listen(port)
}
