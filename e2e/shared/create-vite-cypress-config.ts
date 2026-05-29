import path from "node:path"
import { createServer, type ViteDevServer } from "vite"
import { appendDiag, diagLog, isDiagEnabled } from "./e2e-diag.mjs"
import { freeListeningPort } from "./free-listening-port.mjs"

export type ViteCypressConfigOptions = {
  port: number
  /** Used only when `enableHmr` is true (e.g. CSR advanced / hmr.cy.ts). */
  hmrPort: number
  configFile?: string
  specPattern?: string | string[]
  excludeSpecPattern?: string | string[]
  /**
   * Headless Cypress does not need Vite HMR websockets; disabling avoids
   * "WebSocket server error: Port … is already in use" when shards run in parallel.
   * @default false
   */
  enableHmr?: boolean
  /** Extra Cypress node event setup (tasks, HMR file hooks, etc.). */
  extraSetup?: (
    // @ts-ignore
    on: Cypress.PluginEvents,
    ctx: { port: number }
  ) => void | Promise<void>
  /** Runs after Vite server starts (e.g. restore HMR backups on teardown). */
  afterServerClose?: () => void | Promise<void>
}

async function startViteDevServer(
  port: number,
  hmrPort: number,
  configFile: string,
  enableHmr: boolean
): Promise<{ server: ViteDevServer; listenMs: number }> {
  const configRoot = path.resolve(path.dirname(configFile))
  process.env.KIRU_E2E_DEV_PORT = String(port)
  process.env.KIRU_E2E_HMR_PORT = String(hmrPort)
  if (isDiagEnabled()) {
    process.env.KIRU_RPC_TRACE = "1"
    process.env.KIRU_E2E_DIAG = "1"
  }
  const t0 = Date.now()
  const server = await createServer({
    configFile,
    cacheDir: path.join(configRoot, "node_modules", `.vite-cypress-${port}`),
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: enableHmr
        ? {
            host: "127.0.0.1",
            port: hmrPort,
            clientPort: hmrPort,
          }
        : false,
    },
  })
  await server.listen(port)
  return { server, listenMs: Date.now() - t0 }
}

export function createViteCypressConfig(options: ViteCypressConfigOptions) {
  const {
    port,
    hmrPort,
    configFile = "./vite.config.ts",
    specPattern,
    excludeSpecPattern,
    enableHmr = false,
    extraSetup,
    afterServerClose,
  } = options

  const diag = isDiagEnabled()

  return {
    allowCypressEnv: false,
    e2e: {
      expose: {
        port,
        ...(diag ? { e2eDiag: true } : {}),
      },
      ...(specPattern !== undefined ? { specPattern } : {}),
      ...(excludeSpecPattern !== undefined ? { excludeSpecPattern } : {}),
      setupNodeEvents(on) {
        let server: ViteDevServer | null = null
        let runStartedAt = 0

        if (diag) {
          on("task", {
            e2eDiag(payload: Record<string, unknown>) {
              appendDiag({ kind: "cypress_task", ...payload }, { port })
              return null
            },
          })
          on("after:spec", (spec, results) => {
            appendDiag(
              {
                kind: "after_spec",
                spec: spec.relative,
                state: results?.state,
                duration: results?.stats?.duration,
              },
              { port }
            )
          })
        }

        extraSetup?.(on, { port })

        on("before:run", async () => {
          runStartedAt = Date.now()
          if (diag) {
            diagLog("before:run", { port, hmrPort, configFile })
            appendDiag(
              { kind: "before_run", port, hmrPort, configFile },
              { port }
            )
          }
          freeListeningPort(port)
          if (enableHmr) {
            freeListeningPort(hmrPort)
          }
          const started = await startViteDevServer(
            port,
            hmrPort,
            configFile,
            enableHmr
          )
          server = started.server
          if (diag) {
            const urls = server.resolvedUrls
            appendDiag(
              {
                kind: "vite_listen",
                vite_listen_ms: started.listenMs,
                resolvedUrls: urls,
              },
              { port }
            )
            diagLog("vite ready", started.listenMs, "ms", urls)
          }
        })
        on("after:run", async () => {
          if (diag) {
            appendDiag(
              {
                kind: "after_run",
                totalMs: Date.now() - runStartedAt,
              },
              { port }
            )
          }
          await afterServerClose?.()
          if (server) {
            await server.close()
            server = null
          }
        })
      },
    },
    video: false,
    screenshotOnRunFailure: false,
    numTestsKeptInMemory: 0,
  }
}
