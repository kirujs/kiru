import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { createRenderer } from "kiru/router"
import { routes } from "../routes"

const isProd = process.env.NODE_ENV === "production"
const entryDir = dirname(fileURLToPath(import.meta.url))
/** Production runs the Vite SSR bundle under `dist/server/`; dev uses `src/`. */
const root = join(entryDir, "..", "..")

const clientDist = join(root, "dist", "client")
const templatePath =
  isProd && existsSync(join(clientDist, "index.html"))
    ? join(clientDist, "index.html")
    : join(root, "index.html")
const htmlTemplate = readFileSync(templatePath, "utf8")

const remoteSecret = "sandbox-ssr-remote-secret"

interface User {
  name: string
  age: number
}

declare module "kiru/router" {
  interface CustomRequestContext {
    user: User | null
  }
}

const renderer = createRenderer({
  stream: true,
  routes,
  htmlTemplate,
  actions: {
    secret: remoteSecret,
    /** Wildcard keeps `pnpm dev` working regardless of host/port; tighten in production. */
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
})

const app = new Hono()

if (isProd) {
  app.use(
    "/assets/*",
    serveStatic({
      root: join(clientDist, "assets"),
      rewriteRequestPath: (p) => {
        const rel = p.slice("/assets".length).replace(/^\//, "")
        return rel || "."
      },
    }),
  )
}

app.all("*", async (c, next) => {
  const rendered = await renderer.render(c.req.raw, {
    context: {
      user: {
        name: "John Doe",
        age: 30,
      },
    },
  })
  if (!rendered) {
    return await next()
  }

  const { status, headers, body } = rendered
  return new Response(body, { status, headers })
})

export default app

if (isProd) {
  const { serve } = await import("@hono/node-server")
  const port = Number(process.env.PORT) || 5179
  serve({ fetch: app.fetch, port }, () => {
    console.log(`SSR sandbox listening on http://localhost:${port}`)
  })
}
