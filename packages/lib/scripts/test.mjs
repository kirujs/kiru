import * as esbuild from "esbuild"
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL("..", import.meta.url)))
const srcTests = join(root, "src", "tests")
const outDir = join(root, "dist-test")

function collectTests(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      collectTests(path, acc)
    } else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) {
      acc.push(path)
    }
  }
  return acc
}

/** @param {string} file */
function bootstrapForTestFile(file) {
  const rel = relative(srcTests, file).replace(/\\/g, "/")
  if (rel.includes("guard-ssg") || rel.includes("ssg.")) return "ssg"
  if (rel.includes("guard-ssr") || rel.includes("remote-ssr") || rel.includes("ssr."))
    return "ssr"
  return "csr"
}

const typesCheck = spawnSync(
  "pnpm",
  ["exec", "tsc", "--noEmit", "-p", "tsconfig.types.json"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
)
if (typesCheck.status !== 0) {
  process.exit(typesCheck.status ?? 1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const tests = collectTests(srcTests)
for (const entry of tests) {
  const rel = relative(join(root, "src"), entry).replace(/\\/g, "/")
  const outfile = join(outDir, rel.replace(/\.tsx?$/, ".js"))
  const bootstrap = bootstrapForTestFile(entry)
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "es2022",
    packages: "external",
    define: {
      __KIRU_ROUTER_BOOTSTRAP__: JSON.stringify(bootstrap),
    },
    logLevel: "silent",
  })
}

const result = spawnSync(
  process.execPath,
  ["--test", "dist-test/**/*.test.js"],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development" },
    stdio: "inherit",
  }
)
process.exit(result.status ?? 1)
