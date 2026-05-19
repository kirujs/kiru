import { createServer } from "node:http"
import { createKiruResponder, toNodeListener } from "@kirujs/adapter-node"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruResponder({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

export default { fetch: kiru.fetch }

if (isProd && !("Bun" in globalThis)) {
  const port = Number(process.env.PORT) || 3000
  createServer(toNodeListener(kiru)).listen(port)
}
