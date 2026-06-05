#!/usr/bin/env node
/**
 * Run `tsc --noEmit` across in-scope workspaces (packages + e2e/sandbox apps).
 * Devtools packages are excluded per monorepo TypeScript audit scope.
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const packageDirs = [
  "packages/runtime",
  "packages/adapter-contract",
  "packages/lib",
  "packages/file-routes",
  "packages/adapter-node",
  "packages/adapter-bun",
  "packages/adapter-cloudflare",
  "packages/vite-plugin-kiru",
]

const appConfigs = [
  ...[
    "e2e/csr",
    "e2e/file-routes",
    "e2e/file-routes-ssg",
    "e2e/file-routes-ssr",
    "e2e/path-policy",
    "e2e/ssg",
    "e2e/ssr",
    "e2e/ssr-matrix",
  ].map((d) => `${d}/tsconfig.json`),
  ...[
    "sandbox/csr",
    "sandbox/primitive",
    "sandbox/ssg",
    "sandbox/ssr",
    "sandbox/tauri",
  ].map((d) => `${d}/tsconfig.json`),
]

function runTsc(cwd, args = ["--noEmit"]) {
  const result = spawnSync("pnpm", ["exec", "tsc", ...args], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

let failed = 0

for (const rel of packageDirs) {
  const cwd = join(root, rel)
  const label = rel
  const { ok, stdout, stderr } = runTsc(cwd)
  if (!ok) {
    failed++
    console.error(`\n[FAIL] ${label}`)
    process.stderr.write(stderr || stdout)
  } else {
    console.log(`[ok] ${label}`)
  }
}

for (const rel of appConfigs) {
  const configPath = join(root, rel)
  if (!existsSync(configPath)) {
    console.warn(`[skip] missing ${rel}`)
    continue
  }
  const { ok, stdout, stderr } = runTsc(root, ["--noEmit", "-p", rel])
  if (!ok) {
    failed++
    console.error(`\n[FAIL] ${rel}`)
    process.stderr.write(stderr || stdout)
  } else {
    console.log(`[ok] ${rel}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} workspace(s) failed typecheck`)
  process.exit(1)
}

console.log("\nAll in-scope workspaces passed typecheck")
