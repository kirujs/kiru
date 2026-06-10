import { spawn, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "cypress"
import { assertServerBundleConsistent } from "./scripts/assert-server-bundle.mjs"
import { freeListeningPort } from "../shared/free-listening-port.mjs"
import { e2ePorts } from "../shared/ports.mjs"

const port = e2ePorts.ssr.prod
const root = path.dirname(fileURLToPath(import.meta.url))
const prodServerEntry = path.join(root, "dist", "server", "index.js")
const serverOrigin = `http://127.0.0.1:${port}`

type SpawnedServer = ChildProcess

const HELLO_READY_MARKER = 'data-testid="ssr-loader"'

async function waitForServerReady(
  isAborted: () => Error | undefined,
  timeoutMs = 15_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const abort = isAborted()
    if (abort) throw abort
    try {
      const res = await fetch(`${serverOrigin}/hello`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (res.status === 200) {
        const body = await res.text()
        if (body.includes(HELLO_READY_MARKER)) return
      }
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `production e2e server did not respond on ${serverOrigin} within ${timeoutMs}ms`
  )
}

function childHasExited(child: SpawnedServer): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function childStartupFailure(child: SpawnedServer): Error | undefined {
  if (!childHasExited(child)) return undefined
  const code = child.exitCode
  if (code !== null && code !== 0) {
    return new Error(
      `production e2e server exited with code ${code} before becoming ready`
    )
  }
  return new Error("production e2e server exited before becoming ready")
}

function forceKillChild(child: SpawnedServer): void {
  if (childHasExited(child) || child.pid === undefined) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
      stdio: "ignore",
    })
    return
  }
  child.kill("SIGKILL")
}

function waitForChildExit(
  child: SpawnedServer,
  timeoutMs = 15_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (childHasExited(child)) {
      resolve()
      return
    }
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      if (childHasExited(child)) {
        resolve()
        return
      }
      if (Date.now() >= deadline) {
        reject(new Error("production e2e server did not exit after kill"))
        return
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

async function stopChild(child: SpawnedServer): Promise<void> {
  if (childHasExited(child)) return
  child.kill()
  try {
    await waitForChildExit(child, 3_000)
  } catch {
    forceKillChild(child)
    await waitForChildExit(child)
  }
}

async function startProductionServer(): Promise<{
  close: () => Promise<void>
}> {
  freeListeningPort(port)
  assertServerBundleConsistent(prodServerEntry)

  let startupError: Error | undefined
  const isAborted = (): Error | undefined =>
    startupError ?? childStartupFailure(child)

  const child: ChildProcess = spawn(process.execPath, [prodServerEntry], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString()
    process.stderr.write(chunk)
    if (text.includes("EADDRINUSE")) {
      startupError = new Error(
        `port ${port} is already in use — could not start production e2e server`
      )
    }
  })

  try {
    await waitForServerReady(isAborted)
    return {
      close: async () => {
        await stopChild(child)
        freeListeningPort(port)
      },
    }
  } catch (err) {
    await stopChild(child)
    freeListeningPort(port)
    throw err
  }
}

export default defineConfig({
  e2e: {
    env: {
      port,
    },
    specPattern: "cypress/e2e/{tier3-wave1,threadboard-sandbox,threadboard-nav-tour}.cy.ts",
    setupNodeEvents(on) {
      let prod: { close: () => Promise<void> } | null = null

      on("task", {
        async fetchHtml(url: string) {
          const res = await fetch(url)
          return res.text()
        },
        log(message: string) {
          console.log(message)
          return null
        },
        logRouterDiagnostics(snapshot: Record<string, unknown>) {
          console.log("\n[kiru diagnostics]\n" + JSON.stringify(snapshot, null, 2))
          return null
        },
      })

      on("before:run", async () => {
        if (!fs.existsSync(prodServerEntry)) {
          throw new Error(
            "Run `pnpm run build` in e2e/ssr before tier 3 Cypress tests"
          )
        }
        const { spawnSync } = await import("node:child_process")
        const verify = spawnSync(
          process.execPath,
          ["scripts/verify-hybrid-prerender.mjs"],
          { cwd: root, stdio: "inherit" }
        )
        if (verify.status !== 0) {
          throw new Error(
            "Hybrid prerender artifacts missing — run `pnpm run build` in e2e/ssr"
          )
        }
        prod = await startProductionServer()
      })

      on("after:run", async () => {
        await prod?.close()
        prod = null
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
