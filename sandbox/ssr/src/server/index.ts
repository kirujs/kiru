import { createKiruHandler, serveKiruNode } from "@kirujs/adapter-node"
import { routes } from "../routes"

const isProd = process.env.NODE_ENV === "production"

interface User {
  name: string
  age: number
}

declare module "kiru/router" {
  interface CustomRequestContext {
    user: User | null
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
  getRequestContext: () => ({
    user: {
      name: "John Doe",
      age: 30,
    },
  }),
})

export default { fetch: kiru.fetch }

if (isProd) {
  const port = Number(process.env.PORT) || 5179
  serveKiruNode(kiru, port)
}
