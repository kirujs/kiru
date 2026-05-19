import {
  createKiruBunServer,
  nodeRequestToFetch,
  sendKiruResponse,
} from "@kirujs/adapter-bun"
import Fastify from "fastify"
import { routes } from "../fixture/routes"

const isProd = process.env.NODE_ENV === "production"

const kiru = createKiruBunServer({
  importMetaUrl: import.meta.url,
  dev: !isProd,
  stream: false,
  routes,
})

const fastify = Fastify()
fastify.get("/api/health", async () => ({ ok: true }))
fastify.all("*", async (request, reply) => {
  const out = await kiru.handle(nodeRequestToFetch(request.raw))
  if (out === null) {
    reply.code(404).send("Not Found")
    return
  }
  await sendKiruResponse(reply.raw, out)
})

if (isProd) {
  const port = Number(process.env.PORT) || 3000
  await fastify.listen({ port, host: "127.0.0.1" })
  console.log(`[e2e-ssr-matrix] fastify (bun) listening on http://127.0.0.1:${port}`)
}
