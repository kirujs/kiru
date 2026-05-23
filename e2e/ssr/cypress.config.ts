import { defineConfig } from "cypress"
import { createServer, type ViteDevServer } from "vite"
import { freeListeningPort } from "../shared/free-listening-port.mjs"
import { e2ePorts } from "../shared/ports.mjs"
import { runConcurrentContextCheck } from "./scripts/lib/concurrent-context.mjs"

const port = e2ePorts.ssr.dev
const hmrPort = e2ePorts.ssr.hmr

async function startViteDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: { port: hmrPort },
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
      on("task", {
        concurrentContextCheck({
          port,
          concurrency,
        }: {
          port: number
          concurrency?: number
        }) {
          return runConcurrentContextCheck({
            origin: `http://127.0.0.1:${port}`,
            concurrency,
          })
        },
      })
      on("before:run", async () => {
        freeListeningPort(port)
        freeListeningPort(hmrPort)
        server = await startViteDevServer()
      })
      on("after:run", async () => {
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
