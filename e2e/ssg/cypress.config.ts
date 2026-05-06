import { defineConfig } from "cypress"

const port = 5191

export default defineConfig({
  e2e: {
    baseUrl: `http://127.0.0.1:${port}`,
    setupNodeEvents() {
      // Server is started by start-server-and-test before Cypress runs.
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
