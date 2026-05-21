import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"

async function startServer() {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      hmr: { port: 8015 },
    },
  })
  return await server.listen()
}

export default defineConfig({
  e2e: {
    env: { port: 5175 },
    setupNodeEvents(on) {
      let server: ViteDevServer | null = null
      on("before:run", async () => {
        server = await startServer()
      })
      on("after:run", async () => {
        await server?.close()
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
