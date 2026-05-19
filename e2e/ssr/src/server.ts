import { createServer } from "node:http"
import sharp from "sharp"
import { createKiruHandler, toNodeListener } from "@kirujs/adapter-node"
import i18n from "./i18n.js"
import { routes } from "./routes"
import { imageConfig } from "./imageConfig.js"

const isProd = process.env.NODE_ENV === "production"

declare module "kiru/router" {
  interface CustomRequestContext {
    user: { name: string } | null
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
  getRequestContext: () => ({
    user: { name: "E2E User" },
  }),
  image: isProd ? { config: imageConfig, sharp } : undefined,
})

export default { fetch: kiru.fetch }

if (isProd) {
  const port = Number(process.env.PORT) || 5179
  createServer(toNodeListener(kiru)).listen(port)
}
