import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { e2ePorts } from "../shared/ports.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.ssr.streaming

export default createViteCypressConfig({
  port,
  hmrPort,
  specPattern: ["**/ssr-streaming.cy.ts"],
  excludeSpecPattern: ["**/debug-*.cy.ts"],
})
