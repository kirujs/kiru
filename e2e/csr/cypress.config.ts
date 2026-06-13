import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"
import { registerHmrFileTasks } from "../shared/cypress-hmr-file-tasks"
import { freeListeningPort } from "../shared/free-listening-port.mjs"
import { e2ePorts } from "../shared/ports.mjs"

const port = e2ePorts.csr.dev
const hmrPort = e2ePorts.csr.hmr

async function startServer() {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: {
        port: hmrPort,
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

      on("task", {
        logRouterDiagnostics(snapshot: Record<string, unknown>) {
          console.log("\n[kiru csr diagnostics]\n" + JSON.stringify(snapshot, null, 2))
          return null
        },
      })

      on("before:run", async () => {
        freeListeningPort(port)
        freeListeningPort(hmrPort)
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
