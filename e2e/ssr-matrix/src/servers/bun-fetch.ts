import { createKiruBunServer } from "@kirujs/adapter-bun"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruBunServer({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

export default { fetch: kiru.fetch }
