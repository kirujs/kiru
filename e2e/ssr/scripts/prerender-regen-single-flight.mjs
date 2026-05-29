/**
 * Smoke test: concurrent GETs to a stale hybrid path should not error.
 * Run after `pnpm run build` with production server on PORT (default: e2e/ssr prod port).
 */
import { e2ePorts } from "../../shared/ports.mjs"

const port = Number(process.env.PORT) || e2ePorts.ssr.core.dev
const url = `http://127.0.0.1:${port}/revalidate-demo`

const responses = await Promise.all(
  Array.from({ length: 8 }, () => fetch(url))
)

for (const res of responses) {
  if (!res.ok) {
    console.error("[single-flight] unexpected status", res.status)
    process.exit(1)
  }
}

console.log("[single-flight] ok:", responses.length, "concurrent GETs")
