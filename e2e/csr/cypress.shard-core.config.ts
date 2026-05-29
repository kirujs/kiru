import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.csr.core

export default createViteCypressConfig({
  port,
  hmrPort,
  specPattern: [
    "**/signals.cy.ts",
    "**/reactivity.cy.ts",
    "**/rendering.cy.ts",
    "**/routing.cy.ts",
  ],
})
