import { defineConfig } from "cypress"
import { build, preview, type PreviewServer } from "vite"
import { freeListeningPort } from "../shared/free-listening-port.mjs"

/** Separate from default CSR dev server (5173) so builderman can run both in one `pnpm test`. */
const port = 5174

export default defineConfig({
  e2e: {
    env: { port },
    setupNodeEvents(on) {
      let server: PreviewServer | null = null
      on("before:run", async () => {
        freeListeningPort(port)
        await build({ configFile: "./vite.config.ts" })
        server = await preview({
          configFile: "./vite.config.ts",
          preview: { port, strictPort: true, host: "127.0.0.1" },
        })
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
