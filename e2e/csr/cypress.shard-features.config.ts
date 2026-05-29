import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.csr.features

export default createViteCypressConfig({
  port,
  hmrPort,
  specPattern: [
    "**/style.cy.ts",
    "**/loaders.cy.ts",
    "**/navigation.cy.ts",
    "**/i18n.cy.ts",
    "**/parity.cy.ts",
    "**/keyed-list.cy.ts",
  ],
})
