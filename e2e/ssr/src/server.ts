import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { createRenderer } from "kiru/router"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"
const entryDir = dirname(fileURLToPath(import.meta.url))
/** Production runs the Vite SSR bundle under `dist/server/`; dev uses `src/`. */
const root = isProd ? join(entryDir, "..", "..") : join(entryDir, "..")

const clientDist = join(root, "dist", "client")
const templatePath =
  isProd && existsSync(join(clientDist, "index.html"))
    ? join(clientDist, "index.html")
    : join(root, "index.html")
const htmlTemplate = readFileSync(templatePath, "utf8")
const remoteFunctionSecret = "kiru-e2e-remote-secret"

declare module "kiru/router" {
  interface CustomRequestContext {
    user: { name: string } | null
  }
}

const renderer = createRenderer({
  stream: true,
  routes,
  htmlTemplate,
  actions: {
    secret: remoteFunctionSecret,
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

app.all("*", async (c) => {
  const rendered = await renderer.render(c.req.raw, {
    context: {
      user: { name: "E2E User" },
    },
  })
  if (!rendered) {
    return c.text("Not found", 404)
  }

  const { status, headers, body } = rendered
  return new Response(body, { status, headers })
})

export default app

if (isProd) {
  const { serve } = await import("@hono/node-server")
  const port = Number(process.env.PORT) || 5179
  serve({ fetch: app.fetch, port }, () => {
    console.log(`e2e SSR listening on http://localhost:${port}`)
  })
}
