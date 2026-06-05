import "virtual:kiru:remote-registry"
import "./pages/threadboard/server/seed.js"
import { createServer } from "node:http"
import { createKiruHandler, toNodeListener } from "@kirujs/adapter-node"
import i18n from "./i18n.js"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"

declare module "kiru/router" {
  interface CustomRequestContext {
    user: { name: string; username: string } | null
  }
}

const kiru = createKiruHandler({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: true,
  routes,
  i18n,
  actions: {
    secret: "kiru-e2e-remote-secret",
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
  getRequestContext: async (request) => {
    const name = request.headers.get("x-e2e-user-name")?.trim()
    const username = request.headers.get("x-e2e-user-username")?.trim()
    const anonymous = request.headers.get("x-e2e-anonymous") === "1"
    if (anonymous) {
      return { user: null }
    }
    const resolvedName = name || "E2E User"
    const resolvedUsername = username || name || "e2e-user"
    return {
      user: { name: resolvedName, username: resolvedUsername },
    }
  },
})

export default { fetch: kiru.fetch }

if (isProd) {
  const port = Number(process.env.PORT) || 5179
  createServer(toNodeListener(kiru)).listen(port, "127.0.0.1")
}
