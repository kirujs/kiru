import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"
import { freeListeningPort } from "../shared/free-listening-port.mjs"

const port = 5193

async function startViteDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: { port: 8023 },
    },
  })
  return await server.listen(port)
}

export default defineConfig({
  e2e: {
    env: { port },
    setupNodeEvents(on) {
      let server: ViteDevServer | null = null
      on("before:run", async () => {
        freeListeningPort(port)
        server = await startViteDevServer()
      })
      on("after:run", async () => {
        await server?.close()
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
