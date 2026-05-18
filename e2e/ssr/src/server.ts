import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import sharp from "sharp"
import {
  createRenderer,
  createImageOptimizerIfRuntime,
  resolveStatic,
} from "kiru/router"
import i18n from "./i18n.js"
import { routes } from "./routes"
import { imageConfig } from "./imageConfig.js"

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
  prerenderedHtmlDir: clientDir,
  i18n,
  actions: {
    secret: "kiru-e2e-remote-secret",
    allowedOrigins: ["*"],
    exposeErrors: true,
  },
})

const imageHandler = isProd
  ? createImageOptimizerIfRuntime({
      root: clientDir,
      config: imageConfig,
      sharp,
      cacheDir: isProd ? `${clientDir}/.kiru-image-cache` : undefined,
    })
  : null

const app = new Hono()

if (isProd) {
  if (imageHandler) {
    app.get(imageConfig.path, async (c) => {
      const res = await imageHandler(c.req.raw)
      return res ?? c.text("Not Found", 404)
    })
  }
  app.use("/*", serveStatic({ root: clientDir }))
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
    console.log(
      `e2e SSR listening on http://localhost:${port} (images: ${imageConfig.strategy})`
    )
  })
}
