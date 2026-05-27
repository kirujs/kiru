import { describe, it } from "node:test"
import assert from "node:assert"
import { execSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../.."
)
const sandboxDir = path.join(repoRoot, "sandbox/primitive")

function readProdBundle(): string {
  execSync("pnpm run build", {
    cwd: path.join(repoRoot, "packages/vite-plugin-kiru"),
    stdio: "pipe",
  })
  execSync("pnpm run build", {
    cwd: sandboxDir,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  })
  const assetsDir = path.join(sandboxDir, "dist/assets")
  const jsFile = readdirSync(assetsDir).find((f) => f.endsWith(".js"))
  if (!jsFile) throw new Error("no JS asset in sandbox/primitive dist")
  return readFileSync(path.join(assetsDir, jsFile), "utf8")
}

describe("sandbox/primitive production build", () => {
  it("emits composed templates without jsxDEV or jsx(Badge)", () => {
    const bundle = readProdBundle()
    assert.doesNotMatch(bundle, /jsxDEV/)
    assert.match(bundle, /badge/)
    assert.match(bundle, /<button>Toggle<\/button>/)
    assert.match(bundle, /conditional.*anchor:1|anchor:1.*conditional/)
    assert.match(bundle, /Toggle<\/button><!--#-->/)
    assert.doesNotMatch(bundle, /jsx\(Badge/)
  })
})
