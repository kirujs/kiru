// @ts-check
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const sharedBinaryCache = path.join(repoRoot, ".cache", "cypress-binary")
const profilesRoot = path.join(repoRoot, ".cache", "cypress-profiles")

/** @returns {string} */
function cypressPackageVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "e2e/ssr/package.json"), "utf8")
  )
  const raw = pkg.devDependencies?.cypress ?? "15.16.0"
  return String(raw).replace(/^[\^~]/, "")
}

/** @returns {string | undefined} */
function sharedCypressBinaryPath() {
  const version = cypressPackageVersion()
  const name = process.platform === "win32" ? "Cypress.exe" : "Cypress"
  const candidate = path.join(sharedBinaryCache, version, "Cypress", name)
  return fs.existsSync(candidate) ? candidate : undefined
}

let sharedBinaryReady = false

/** One-time shared Cypress binary install for repo-local cache. */
export function ensureSharedCypressBinary() {
  if (sharedBinaryReady || !isCypressProfileIsolationEnabled()) return
  sharedBinaryReady = true
  if (sharedCypressBinaryPath()) return

  fs.mkdirSync(sharedBinaryCache, { recursive: true })
  const version = cypressPackageVersion()
  console.log(
    `[cypress-profile] Installing Cypress ${version} to ${sharedBinaryCache}`
  )
  execSync("pnpm exec cypress install", {
    cwd: path.join(repoRoot, "e2e/ssr"),
    env: { ...process.env, CYPRESS_CACHE_FOLDER: sharedBinaryCache },
    stdio: "inherit",
  })
}

/** @returns {boolean} */
export function isCypressProfileIsolationEnabled() {
  const flag = process.env.KIRU_CYPRESS_PROFILE_ISOLATION
  if (flag === "0" || flag === "false") return false
  if (flag === "1" || flag === "true") return true
  return process.platform === "win32"
}

/**
 * Per-shard Cypress profile dirs so parallel Windows runs do not race on
 * `%APPDATA%\Cypress\DevToolsActivePort` or `%LOCALAPPDATA%\Cypress\Cache\bundles\`.
 * The Cypress binary is shared via `CYPRESS_RUN_BINARY`.
 *
 * @param {string | number} profileId Unique shard key (dev port recommended).
 * @returns {Record<string, string>}
 */
export function cypressProfileEnv(profileId) {
  if (!isCypressProfileIsolationEnabled()) return {}

  const id = String(profileId)
  const profileRoot = path.join(profilesRoot, id)
  const roaming = path.join(profileRoot, "Roaming")
  const local = path.join(profileRoot, "Local")

  fs.mkdirSync(roaming, { recursive: true })
  fs.mkdirSync(local, { recursive: true })

  /** @type {Record<string, string>} */
  const env = {}

  const binary = sharedCypressBinaryPath()
  if (binary) env.CYPRESS_RUN_BINARY = binary

  if (process.platform === "win32") {
    env.APPDATA = roaming
    env.LOCALAPPDATA = local
  } else {
    env.XDG_CONFIG_HOME = path.join(profileRoot, "xdg-config")
    env.XDG_CACHE_HOME = path.join(profileRoot, "xdg-cache")
    fs.mkdirSync(env.XDG_CONFIG_HOME, { recursive: true })
    fs.mkdirSync(env.XDG_CACHE_HOME, { recursive: true })
  }

  return env
}

export { profilesRoot, repoRoot, sharedBinaryCache }
