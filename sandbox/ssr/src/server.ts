import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { createRenderer } from "kiru/router"
import { createRemoteActionHandler, __INTERNAL_REMOTE_REGISTRY } from "kiru/remote"
import { routes } from "./routes"


const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const isServe = process.env.SERVE === "1"
const templatePath =
  isServe && existsSync(join(root, "dist", "index.html"))
    ? join(root, "dist", "index.html")
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
  routes,
  htmlTemplate,
  remoteFunctionSecret: remoteSecret,
})

/** Wildcard keeps `pnpm dev` working regardless of host/port; tighten in production. */
const handleAction = createRemoteActionHandler(remoteSecret, {
  allowedOrigins: ["*"],
  exposeErrors: true,
})

const app = new Hono()

if (isServe) {
  app.get("/assets/*", async (c) => {
    const path = c.req.path
    const filePath = join(root, "dist", path)
    if (!existsSync(filePath)) return c.notFound()
    const body = await import("node:fs/promises").then((fs) =>
      fs.readFile(filePath)
    )
    const contentType = path.endsWith(".css")
      ? "text/css"
      : path.endsWith(".js")
        ? "application/javascript"
        : "application/octet-stream"
    return new Response(body as unknown as BodyInit, {
      headers: { "content-type": contentType },
    })
  })
}

app.all("*", async (c) => {
  if (c.req.method === "POST" && c.req.query("action")) {
    const actionResponse = await handleAction(c.req.raw)
    if (actionResponse) return actionResponse
  }

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
