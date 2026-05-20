/**
 * Many parallel GETs with distinct per-request context must not cross-contaminate
 * SSR HTML, serialized context, or action RPC.
 *
 * Uses the production SSR bundle from `pnpm run build` (ephemeral PORT, or set PORT).
 * Cypress runs the same checks via `cy.task("concurrentContextCheck")` on 5192.
 */
import { spawn } from "node:child_process"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { freeListeningPort } from "./free-listening-port.mjs"
import { runConcurrentContextCheck } from "./lib/concurrent-context.mjs"

const e2eRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const serverEntry = path.join(e2eRoot, "dist", "server", "index.js")
const concurrency = Number(process.env.KIRU_E2E_CONTEXT_CONCURRENCY) || 32

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

async function resolvePort() {
  if (process.env.PORT) {
    const port = Number(process.env.PORT)
    freeListeningPort(port)
    return port
  }
  return getFreePort()
}

async function waitForServer(origin, deadlineMs = 30_000) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/hello`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (res.ok && (await res.text()).includes('data-testid="ssr-loader"')) {
        return
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`server not ready on ${origin}`)
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    child.once("exit", resolve)
    child.kill()
  })
}

const port = await resolvePort()
const origin = `http://127.0.0.1:${port}`

const child = spawn(process.execPath, [serverEntry], {
  cwd: e2eRoot,
  env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
})
child.stderr?.on("data", (chunk) => process.stderr.write(chunk))

try {
  await waitForServer(origin)
  await runConcurrentContextCheck({ origin, concurrency })
  console.log(
    "[concurrent-context] ok:",
    concurrency,
    "parallel GETs + action RPCs on",
    origin
  )
} finally {
  await stopChild(child)
}
