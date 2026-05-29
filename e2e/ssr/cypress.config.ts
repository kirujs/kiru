import { createViteCypressConfig } from "../shared/create-vite-cypress-config"
import { e2ePorts } from "../shared/ports.mjs"
import { runConcurrentContextCheck } from "./scripts/lib/concurrent-context.mjs"

const { dev: port, hmr: hmrPort } = e2ePorts.ssr.core

/** Default config: all production SSR specs (excludes debug + tier3). */
export default createViteCypressConfig({
  port,
  hmrPort,
  excludeSpecPattern: ["**/debug-*.cy.ts", "**/tier3-wave1.cy.ts"],
  extraSetup(on, { port: p }) {
    on("task", {
      concurrentContextCheck({
        port: taskPort,
        concurrency,
      }: {
        port: number
        concurrency?: number
      }) {
        return runConcurrentContextCheck({
          origin: `http://127.0.0.1:${taskPort ?? p}`,
          concurrency,
        })
      },
    })
  },
})
