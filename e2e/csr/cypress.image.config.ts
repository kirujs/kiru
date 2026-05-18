import { defineConfig } from "cypress"
import { build, preview, type PreviewServer } from "vite"

const port = 5173

export default defineConfig({
  e2e: {
    env: { port },
    setupNodeEvents(on) {
      let server: PreviewServer | null = null
      on("before:run", async () => {
        await build({ configFile: "./vite.config.ts" })
        server = await preview({
          configFile: "./vite.config.ts",
          preview: { port, strictPort: true, host: "127.0.0.1" },
        })
      })
      on("after:run", async () => {
        await server?.close()
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
