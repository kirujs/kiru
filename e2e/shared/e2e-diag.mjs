import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { e2ePorts } from "./ports.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")

export function isDiagEnabled() {
  return process.env.KIRU_E2E_DIAG === "1"
}

export function diagDir() {
  const dir = path.join(repoRoot, ".e2e-diag")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * @param {Record<string, unknown>} event
 * @param {{ port?: number; taskId?: string }} [opts]
 */
export function appendDiag(event, opts = {}) {
  if (!isDiagEnabled()) return
  const port = opts.port ?? process.env.KIRU_E2E_DEV_PORT
  const suffix =
    port !== undefined && port !== ""
      ? `events-${port}`
      : opts.taskId
        ? `events-${opts.taskId}`
        : "events"
  const file = path.join(diagDir(), `${suffix}.jsonl`)
  const line = JSON.stringify({
    ts: Date.now(),
    ...event,
  })
  fs.appendFileSync(file, `${line}\n`, "utf8")
}

/** @param  {...unknown} args */
export function diagLog(...args) {
  if (!isDiagEnabled()) return
  console.log("[e2e-diag]", ...args)
}

export { e2ePorts, repoRoot }
