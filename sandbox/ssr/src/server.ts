import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { createRenderer } from "kiru/router"
import { routes } from "./routes"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isServe = process.env.SERVE === "1"
const templatePath =
  isServe && existsSync(join(root, "dist", "index.html"))
    ? join(root, "dist", "index.html")
    : join(root, "index.html")
const htmlTemplate = readFileSync(templatePath, "utf8")

interface User {
  name: string
  age: number
}

declare module "kiru/router" {
  interface CustomRequestContext {
    user: User | null
  }
}

const renderer = createRenderer({ routes, htmlTemplate })
const app = new Hono()

app.all("*", async (c) => {
  const rendered = await renderer.render(c.req.url, {
    context: {
      user: {
        name: "John Doe",
        age: 30,
      },
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
    console.log(`SSR sandbox listening on http://localhost:${port}`)
  })
}
