import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"
import { registerHmrFileTasks } from "../shared/cypress-hmr-file-tasks"
import { freeListeningPort } from "../shared/free-listening-port.mjs"

const port = 5173

async function startServer() {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: {
        port: 8003,
      },
    },
  })
  return await server.listen()
}

export default defineConfig({
  e2e: {
    env: {
      port,
    },
    setupNodeEvents(on) {
      let server: ViteDevServer | null = null
      const restoreAllHmrFiles = registerHmrFileTasks(on)

      on("before:run", async () => {
        freeListeningPort(port)
        server = await startServer()
      })
      on("after:run", async () => {
        await restoreAllHmrFiles()
        if (server) {
          await server.close()
          server = null
        }
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
