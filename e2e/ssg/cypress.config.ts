import { defineConfig } from "cypress"
import { preview, type PreviewServer } from "vite"

export default defineConfig({
  e2e: {
    async setupNodeEvents(on, config) {
      const server: PreviewServer = await preview({
        configFile: "./vite.config.ts",
        preview: { port: 0, strictPort: false, host: "127.0.0.1" },
      })
      const local = server.resolvedUrls?.local?.[0]?.replace(/\/$/, "")
      if (!local) {
        await server.close()
        throw new Error("[e2e-ssg] vite preview did not resolve a local URL")
      }
      config.baseUrl = local

      on("after:run", async () => {
        await server.close()
      })

      return config
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
