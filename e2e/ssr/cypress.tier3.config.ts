import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "cypress"

const port = 5193
const root = path.dirname(fileURLToPath(import.meta.url))
const prodServerEntry = path.join(root, "dist", "server", "index.js")
const serverOrigin = `http://127.0.0.1:${port}`

type SpawnedServer = ReturnType<typeof spawn>

async function waitForServerReady(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${serverOrigin}/hello`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (res.status < 500) return
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

async function startProductionServer(): Promise<{
  close: () => Promise<void>
}> {
  const child = spawn(process.execPath, [prodServerEntry], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  try {
    await waitForServerReady()
    return {
      close: async () => {
        if (childHasExited(child)) return
        child.kill()
        try {
          await waitForChildExit(child, 3_000)
        } catch {
          forceKillChild(child)
          await waitForChildExit(child)
        }
      },
    }
  } catch (err) {
    if (!childHasExited(child)) {
      child.kill()
      try {
        await waitForChildExit(child, 3_000)
      } catch {
        forceKillChild(child)
        await waitForChildExit(child).catch(() => undefined)
      }
    }
    throw err
  }
}

export default defineConfig({
  e2e: {
    env: {
      port,
    },
    specPattern: "cypress/e2e/tier3-wave1.cy.ts",
    setupNodeEvents(on) {
      let prod: { close: () => Promise<void> } | null = null

      on("before:run", async () => {
        if (!fs.existsSync(prodServerEntry)) {
          throw new Error(
            "Run `pnpm run build` in e2e/ssr before tier 3 Cypress tests"
          )
        }
        prod = await startProductionServer()
      })

      on("after:run", async () => {
        await prod?.close()
      })
    },
  },
  video: false,
  screenshotOnRunFailure: false,
})
