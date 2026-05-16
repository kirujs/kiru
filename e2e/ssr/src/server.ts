import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { createRenderer, resolveStatic } from "kiru/router"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"
const { clientDir, htmlTemplate } = resolveStatic(import.meta.url, { dev: !isProd })

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
    secret: "kiru-e2e-remote-secret",
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
})

const app = new Hono()

if (isProd) {
  app.use("/assets/*", serveStatic({ root: clientDir }))
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
