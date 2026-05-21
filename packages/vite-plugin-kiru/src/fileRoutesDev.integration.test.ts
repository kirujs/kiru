import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { createPluginState } from "./config.js"
import {
  resolveFileRoutesOption,
  resolveFileRoutesPaths,
} from "./fileRoutesConfig.js"
import type { PluginState } from "./config.js"
import { writeGeneratedRoutes } from "./fileRoutesCodegen.js"
import {
  attachFileRoutesDevWatcher,
  regenerateFileRoutes,
  resetFileRoutesDebounce,
  scheduleFileRoutesRegen,
  setFileRoutesDebounceMs,
} from "./fileRoutesDev.js"

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 25
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error("waitUntil timed out")
}

function scaffoldProject(root: string) {
  const pagesDir = path.join(root, "src", "pages")
  const routesGen = path.join(root, "src", "routes.gen.ts")
  return { pagesDir, routesGen }
}

async function writeMinimalProject(root: string) {
  const { pagesDir } = scaffoldProject(root)
  await fs.mkdir(pagesDir, { recursive: true })
  await fs.writeFile(
    path.join(root, "index.html"),
    '<!doctype html><html><body><div id="app"></div></body></html>\n'
  )
  await fs.writeFile(
    path.join(pagesDir, "page.tsx"),
    'export default function Home() { return () => <p>Home</p> }\n'
  )
}

async function createTestState(root: string): Promise<PluginState> {
  const fr = resolveFileRoutesOption(
    { dir: "./src/pages", outFile: "./src/routes.gen.ts" },
    root
  )!
  await resolveFileRoutesPaths(fr, root)
  const partial = createPluginState()
  return {
    ...partial,
    projectRoot: root,
    isProduction: false,
    isBuild: false,
    isSSRBuild: false,
    devtoolsEnabled: false,
    loggingEnabled: false,
    includedPaths: [],
    outDir: "dist",
    baseOutDir: "dist",
    fileLinkFormatter: () => "",
    dtClientPathname: "/__devtools__",
    dtHostScriptPath: "/__devtools_host__.js",
    manifestPath: "vite-manifest.json",
    features: { staticHoisting: false },
    staticProps: {},
    remotePaths: [],
    loaderModulesByRouteId: new Map(),
    ssgPrerenderCache: null,
    router: {
      ssg: null,
      serverEntry: null,
      serverEntryAbs: null,
      remote: null,
      adapter: "node",
      fileRoutes: fr,
    },
  } as PluginState
}

describe("file routes dev regeneration", () => {
  let root = ""
  let server: import("vite").ViteDevServer | undefined
  let state: PluginState | undefined
  let pagesDir = ""
  let routesGen = ""

  beforeEach(async () => {
    setFileRoutesDebounceMs(20)
    resetFileRoutesDebounce()
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kiru-fbr-dev-"))
    const paths = scaffoldProject(root)
    pagesDir = paths.pagesDir
    routesGen = paths.routesGen
    await writeMinimalProject(root)
    state = await createTestState(root)
  })

  afterEach(async () => {
    resetFileRoutesDebounce()
    if (server) await server.close()
    server = undefined
    state = undefined
    await fs.rm(root, { recursive: true, force: true })
  })

  async function startWatcher() {
    const { createServer } = await import("vite")
    server = await createServer({ root, logLevel: "error", plugins: [] })
    await server.listen({ port: 0 })
    attachFileRoutesDevWatcher(state!, server)
    await regenerateFileRoutes(state!, server)
  }

  async function flushDebouncedRegen(): Promise<void> {
    await new Promise((r) => setTimeout(r, 80))
    await regenerateFileRoutes(state!, server!)
  }

  async function readRoutesGen(): Promise<string> {
    return fs.readFile(routesGen, "utf8")
  }

  it("writes routes.gen.ts via writeGeneratedRoutes", async () => {
    const { written } = await writeGeneratedRoutes(state!.router.fileRoutes!)
    assert.equal(written, true)
    const source = await readRoutesGen()
    assert.ok(source.includes("createRouteTree"))
    assert.ok(source.includes('createRoute("/",'))
  })

  it("writes routes.gen.ts when the dev watcher attaches", async () => {
    await startWatcher()
    await waitUntil(async () => {
      try {
        const source = await readRoutesGen()
        return (
          source.includes("createRouteTree") &&
          source.includes('createRoute("/",')
        )
      } catch {
        return false
      }
    })
    const source = await readRoutesGen()
    assert.ok(source.includes("interface RouteTree"))
    assert.ok(!source.includes("/dev-added"))
  })

  it("debounces regeneration after filesystem changes", async () => {
    await startWatcher()
    const addedDir = path.join(pagesDir, "debounced")
    const addedPage = path.join(addedDir, "page.tsx")
    await fs.mkdir(addedDir, { recursive: true })
    await fs.writeFile(addedPage, "export default () => () => null\n")
    scheduleFileRoutesRegen(state!, server!)
    await new Promise((r) => setTimeout(r, 80))
    await waitUntil(async () =>
      (await readRoutesGen()).includes('createRoute("/debounced"')
    )
  })

  it("regenerates routes.gen.ts when a page is added", async () => {
    await startWatcher()
    await waitUntil(async () => (await readRoutesGen()).includes('createRoute("/",'))

    const addedDir = path.join(pagesDir, "dev-added")
    const addedPage = path.join(addedDir, "page.tsx")
    await fs.mkdir(addedDir, { recursive: true })
    await fs.writeFile(
      addedPage,
      'export default function Added() { return () => <p>added</p> }\n'
    )

    server!.watcher.emit("add", addedPage)
    await flushDebouncedRegen()

    await waitUntil(async () =>
      (await readRoutesGen()).includes('createRoute("/dev-added"')
    )
  })

  it("regenerates routes.gen.ts when a page is removed", async () => {
    await startWatcher()
    await waitUntil(async () => (await readRoutesGen()).includes('createRoute("/",'))

    const addedDir = path.join(pagesDir, "dev-removed")
    const addedPage = path.join(addedDir, "page.tsx")
    await fs.mkdir(addedDir, { recursive: true })
    await fs.writeFile(addedPage, "export default () => () => null\n")
    server!.watcher.emit("add", addedPage)
    await flushDebouncedRegen()
    await waitUntil(async () =>
      (await readRoutesGen()).includes('createRoute("/dev-removed"')
    )

    await fs.rm(addedPage)
    server!.watcher.emit("unlink", addedPage)
    await flushDebouncedRegen()
    await waitUntil(async () => {
      const source = await readRoutesGen()
      return !source.includes('createRoute("/dev-removed"')
    })
  })
})
