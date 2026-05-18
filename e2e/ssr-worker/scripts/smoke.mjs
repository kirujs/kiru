import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

const PORT = 5195

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
  throw new Error(`Timeout waiting for ${url}`)
}

const wrangler = spawn(
  "pnpm",
  ["exec", "wrangler", "dev", "--port", String(PORT), "--local"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, NODE_ENV: "production" },
  }
)

wrangler.stderr?.on("data", (d) => process.stderr.write(d))
wrangler.stdout?.on("data", (d) => process.stdout.write(d))

let passed = false
try {
  const base = `http://127.0.0.1:${PORT}`
  await waitFor(`${base}/`)
  const home = await fetch(`${base}/`)
  if (!home.ok) throw new Error(`/ ${home.status}`)
  const homeBody = await home.text()
  if (homeBody.includes("{{kiru_body}}")) {
    throw new Error("home returned unrendered HTML shell")
  }
  if (!homeBody.includes("Worker E2E Home")) {
    throw new Error("missing SSR home body")
  }

  await waitFor(`${base}/hello`)
  const hello = await fetch(`${base}/hello`)
  if (!hello.ok) throw new Error(`/hello ${hello.status}`)
  const helloBody = await hello.text()
  if (!helloBody.includes("SSR hello")) throw new Error("missing SSR body")

  const docs = await fetch(`${base}/docs`)
  if (!docs.ok) throw new Error(`/docs ${docs.status}`)
  const docsBody = await docs.text()
  if (!docsBody.includes("Immutable static docs")) {
    throw new Error("missing prerendered docs body")
  }

  console.log("e2e-ssr-worker smoke passed")
  passed = true
} finally {
  wrangler.kill("SIGTERM")
}
process.exit(passed ? 0 : 1)
