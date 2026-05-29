import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { registerHmrFileTasks } from "../shared/cypress-hmr-file-tasks"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.csr.core

let restoreAllHmrFiles: (() => Promise<void>) | undefined

/** Default config: all CSR specs (single Vite server). */
export default createViteCypressConfig({
  port,
  hmrPort,
  enableHmr: true,
  extraSetup(on) {
    restoreAllHmrFiles = registerHmrFileTasks(on)
  },
  afterServerClose: async () => {
    await restoreAllHmrFiles?.()
  },
})
