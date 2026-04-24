import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"
import { registerHmrFileTasks } from "../shared/cypress-hmr-file-tasks"

async function startServer() {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      hmr: {
        port: 8004,
      },
    },
  })
  return await server.listen(5174)
}

export default defineConfig({
  e2e: {
    env: {
      port: 5174,
    },
    setupNodeEvents(on) {
      let server: ViteDevServer | null = null
      const restoreAllHmrFiles = registerHmrFileTasks(on)
      on("before:run", async () => {
        server = await startServer()
      })
      on("after:run", async () => {
        await restoreAllHmrFiles()
        await server?.close()
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
