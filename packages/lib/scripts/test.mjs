import * as esbuild from "esbuild"
import { spawnSync } from "node:child_process"
import os from "node:os"
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

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const tests = collectTests(srcTests)
const ESBUILD_CONCURRENCY = Math.min(12, os.availableParallelism?.() ?? 8)
const testConcurrency = Math.max(
  1,
  Number(process.env.KIRU_LIB_TEST_CONCURRENCY) ||
    Math.min(os.availableParallelism?.() ?? 8, 12)
)

async function buildTestBundle(entry) {
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

for (let i = 0; i < tests.length; i += ESBUILD_CONCURRENCY) {
  await Promise.all(
    tests.slice(i, i + ESBUILD_CONCURRENCY).map((entry) => buildTestBundle(entry))
  )
}

const testFiles = tests.map((entry) => {
  const rel = relative(join(root, "src"), entry).replace(/\\/g, "/")
  return join(outDir, rel.replace(/\.tsx?$/, ".js"))
})

const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency", String(testConcurrency), ...testFiles],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development" },
    stdio: "inherit",
  }
)
process.exit(result.status ?? 1)
