import { spawn } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { cellWranglerConfig } from "./cell-dist.mjs"

export const packageRoot = fileURLToPath(new URL("..", import.meta.url))

/** Resolve a package CLI bin (Vite does not export `./bin/*` in package exports). */
export function resolveBin(name) {
  const candidates = [
    path.join(packageRoot, "node_modules", name, "bin", `${name}.js`),
    path.join(packageRoot, "..", "..", "node_modules", name, "bin", `${name}.js`),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  throw new Error(`Could not find ${name} CLI under ${packageRoot}`)
}

/** `pnpm exec` with Windows-friendly executable. */
export function pnpmExecArgs(args) {
  const isWin = process.platform === "win32"
  return {
    command: isWin ? "pnpm.cmd" : "pnpm",
    args: ["exec", ...args],
  }
}

/**
 * @param {import("./cells.mjs").MatrixCell} cell
 */
const VITE_BUILD_ARGS = ["build", "--configLoader", "native"]

export function cellBuildCommand(cell) {
  if (cell.build === "bun-vite") {
    return { command: "bunx", args: ["--bun", "vite", ...VITE_BUILD_ARGS] }
  }
  return { command: process.execPath, args: [resolveBin("vite"), ...VITE_BUILD_ARGS] }
}

/**
 * @param {import("./cells.mjs").MatrixCell} cell
 * @param {number} port
 */
export function cellStartCommand(cell, port) {
  const spec = cell.start(port)
  if (spec.command === "wrangler-dev") {
    const cellId = process.env.KIRU_MATRIX_CELL
    const configFile = cellId ? cellWranglerConfig(cellId) : "wrangler.toml.generated"
    const { command, args } = pnpmExecArgs([
      "wrangler",
      "dev",
      "--config",
      configFile,
      "--port",
      spec.args[0],
      "--local",
    ])
    return { command, args, shell: process.platform === "win32" }
  }
  return spec
}

export function getFreePort() {
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

export async function waitFor(url, attempts = 60) {
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

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, stdio?: "inherit" | "pipe" }} [opts]
 */
export function run(command, args, opts = {}) {
  const { cwd = packageRoot, env, stdio = "inherit" } = opts
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      shell: false,
      env: { ...process.env, ...env },
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`))
    })
  })
}

/**
 * @param {{ command: string, args: string[], shell?: boolean, env?: Record<string, string | undefined> }} spec
 */
export function spawnServer(spec, port) {
  const env = {
    ...process.env,
    ...spec.env,
    NODE_ENV: "production",
    PORT: String(port),
  }
  return spawn(spec.command, spec.args, {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: spec.shell ?? false,
    env,
  })
}

export async function commandExists(name) {
  const cmd = process.platform === "win32" ? "where" : "which"
  try {
    await run(cmd, [name], { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}
