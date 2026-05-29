import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { registerHmrFileTasks } from "../shared/cypress-hmr-file-tasks"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.csr.advanced

let restoreAllHmrFiles: (() => Promise<void>) | undefined

export default createViteCypressConfig({
  port,
  hmrPort,
  enableHmr: true,
  specPattern: [
    "**/hmr.cy.ts",
    "**/view-transitions.cy.ts",
    "**/effects.cy.ts",
    "**/error-recovery.cy.ts",
  ],
  extraSetup(on) {
    restoreAllHmrFiles = registerHmrFileTasks(on)
  },
  afterServerClose: async () => {
    await restoreAllHmrFiles?.()
  },
})
