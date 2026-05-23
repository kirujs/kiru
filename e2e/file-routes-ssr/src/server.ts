import { createServer } from "node:http"
import { createKiruHandler, toNodeListener } from "@kirujs/adapter-node"
import { e2ePorts } from "../../shared/ports.mjs"
import { routes } from "./routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruHandler({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  routes,
})

export default { fetch: kiru.fetch }

if (isProd) {
  const port = Number(process.env.PORT) || e2ePorts.fileRoutesSsr.prod
  createServer(toNodeListener(kiru)).listen(port, "127.0.0.1")
}
