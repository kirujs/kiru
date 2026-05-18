import { spawn } from "node:child_process"
import net from "node:net"
import { setTimeout as delay } from "node:timers/promises"

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

const PORT = Number(process.env.PORT) || (await getFreePort())

async function waitFor(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
    } catch {
      /* retry */
    }
    await delay(250)
  }
  throw new Error(`Timeout: ${url}`)
}

function assertNoTemplate(html, label) {
  if (html.includes("{{kiru_body}}") || html.includes("{{kiru_head}}")) {
    throw new Error(`${label}: returned unrendered HTML shell`)
  }
}

async function assertBunRuntime(base) {
  const res = await fetch(`${base}/__runtime`)
  if (!res.ok) throw new Error(`/__runtime ${res.status}`)
  const body = await res.text()
  if (!body.includes('data-testid="runtime"')) {
    throw new Error("/__runtime missing runtime marker")
  }
  if (!body.includes("bun@")) {
    throw new Error(`/__runtime expected bun@…, got: ${body.slice(0, 120)}`)
  }
}

/** Bun auto-serves `export default app`; Node loads the bundle and exits. */
async function assertNodeEntryExitsWithoutListening() {
  const cwd = new URL("..", import.meta.url)
  const result = await new Promise((resolve) => {
    const node = spawn("node", ["dist/server/index.js"], {
      cwd,
      stdio: "ignore",
      env: { ...process.env, NODE_ENV: "production", PORT: "0" },
    })
    const timer = setTimeout(() => {
      node.kill("SIGKILL")
      resolve({ ok: false, reason: "still running after 1.5s" })
    }, 1500)
    node.on("exit", (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, reason: code === 0 ? undefined : `exit ${code}` })
    })
  })
  if (!result.ok) {
    throw new Error(
      `node dist/server/index.js must exit without listening (use bun to serve): ${result.reason}`
    )
  }
}

let passed = false

await assertNodeEntryExitsWithoutListening()

const bun = spawn("bun", ["dist/server/index.js"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) },
})

try {
  const base = `http://127.0.0.1:${PORT}`
  await waitFor(`${base}/`)

  const home = await fetch(`${base}/`)
  if (!home.ok) throw new Error(`/ ${home.status}`)
  const homeBody = await home.text()
  assertNoTemplate(homeBody, "/")
  if (!homeBody.includes("Bun E2E Home")) {
    throw new Error("missing SSR home body")
  }

  const hello = await fetch(`${base}/hello`)
  if (!hello.ok) throw new Error(`/hello ${hello.status}`)
  const helloBody = await hello.text()
  assertNoTemplate(helloBody, "/hello")
  if (!helloBody.includes("Bun SSR")) {
    throw new Error("missing SSR hello body")
  }

  await assertBunRuntime(base)

  console.log("e2e-ssr-bun smoke passed")
  passed = true
} finally {
  bun.kill("SIGTERM")
}
process.exit(passed ? 0 : 1)
