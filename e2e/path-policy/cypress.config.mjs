import { defineConfig } from "cypress"
import { createServer } from "vite"
import { freeListeningPort } from "../shared/free-listening-port.mjs"
import { e2ePorts } from "../shared/ports.mjs"

const port = e2ePorts.pathPolicy.dev
const hmrPort = e2ePorts.pathPolicy.hmr

async function startServer() {
  const server = await createServer({
    configFile: "./vite.config.ts",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: { port: hmrPort },
    },
  })
  return await server.listen()
}

export default defineConfig({
  e2e: {
    supportFile: false,
    env: { port },
    setupNodeEvents(on) {
      let server = null
      on("before:run", async () => {
        freeListeningPort(port)
        freeListeningPort(hmrPort)
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
