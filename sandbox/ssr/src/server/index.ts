import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import { createRenderer, resolveStatic } from "kiru/router"
import { routes } from "../routes"

const isProd = process.env.NODE_ENV === "production"
const { clientDir, htmlTemplate } = resolveStatic(import.meta.url, { dev: !isProd })

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
    secret: "sandbox-ssr-remote-secret",
    /** Wildcard keeps `pnpm dev` working regardless of host/port; tighten in production. */
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
})

const app = new Hono()

if (isProd) {
  app.use("/assets/*", serveStatic({ root: clientDir }))
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
