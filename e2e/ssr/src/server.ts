import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { createRenderer } from "kiru/router"
import { routes } from "./routes"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const templatePath = existsSync(join(root, "dist", "index.html"))
  ? join(root, "dist", "index.html")
  : join(root, "index.html")
const htmlTemplate = readFileSync(templatePath, "utf8")

const renderer = createRenderer({ routes, htmlTemplate })

const app = new Hono()

app.all("*", async (c) => {
  const rendered = await renderer.render(c.req.url)
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
