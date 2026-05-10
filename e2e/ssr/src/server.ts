import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { createRenderer } from "kiru/router"
import { routes } from "./routes"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isServe = process.env.SERVE === "1"
const templatePath =
  isServe && existsSync(join(root, "dist", "index.html"))
    ? join(root, "dist", "index.html")
    : join(root, "index.html")
const htmlTemplate = readFileSync(templatePath, "utf8")
const remoteFunctionSecret = "kiru-e2e-remote-secret"

declare module "kiru/router" {
  interface CustomRequestContext {
    user: { name: string } | null
  }
}

const renderer = createRenderer({
  routes,
  htmlTemplate,
  actions: {
    secret: remoteFunctionSecret,
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
})

const app = new Hono()

if (isServe) {
  app.use(
    "/assets/*",
    serveStatic({
      root: join(root, "dist", "assets"),
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

if (process.env.SERVE === "1") {
  const { serve } = await import("@hono/node-server")
  const port = Number(process.env.PORT) || 5179
  serve({ fetch: app.fetch, port }, () => {
    console.log(`e2e SSR listening on http://localhost:${port}`)
  })
}
