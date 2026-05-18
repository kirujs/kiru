import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"

const port = 5192

async function startViteDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
  })
  return await server.listen(port)
}

export default defineConfig({
  e2e: {
    env: {
      port,
    },
    excludeSpecPattern: ["**/tier3-wave1.cy.ts"],
    setupNodeEvents(on) {
      let server: ViteDevServer | null = null
      on("before:run", async () => {
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
