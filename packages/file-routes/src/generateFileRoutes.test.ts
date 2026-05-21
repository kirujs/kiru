import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import assert from "node:assert"
import { compileRouteTree, matchRoute } from "kiru/router"
import { generateFileRoutes } from "./index.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(here, "..", "fixtures")

describe("generateFileRoutes", () => {
  it("generates basic routes with nested middleware scope", async () => {
    const pagesDir = path.join(fixtures, "basic", "pages")
    const outFile = path.join(fixtures, "basic", "routes.gen.ts")
    const { source, routes } = await generateFileRoutes({ pagesDir, outFile })

    assert.ok(source.includes("createRouteTree"))
    assert.ok(source.includes("createRoute"))
    assert.ok(source.includes("interface RouteTree"))
    assert.ok(source.includes("collectRouteMiddlewareModule"))
    assert.ok(source.includes("guarded/middleware"))
    assert.deepStrictEqual(
      [...routes.keys()].sort(),
      ["/", "/about", "/guarded"]
    )

    const { writeFile } = await import("node:fs/promises")
    const tmpRoutes = path.join(fixtures, "basic", "routes.gen.ts")
    await writeFile(tmpRoutes, source, "utf8")
    const loaded = await import(pathToFileUrl(tmpRoutes))
    const manifest = compileRouteTree(loaded.routes)
    assert.ok(matchRoute(manifest, "/"))
    assert.ok(matchRoute(manifest, "/about"))
    assert.ok(matchRoute(manifest, "/guarded"))
    const guarded = matchRoute(manifest, "/guarded")!
    assert.ok(
      guarded.route.scopes.some((s) => s.middleware && s.middleware.length > 0)
    )
  })

  it("generates route groups and dynamic segments", async () => {
    const pagesDir = path.join(fixtures, "advanced", "pages")
    const outFile = path.join(fixtures, "advanced", "routes.gen.ts")
    const { routes } = await generateFileRoutes({ pagesDir, outFile })

    assert.deepStrictEqual(
      [...routes.keys()].sort(),
      ["/", "/blog/[slug]", "/docs/[...slug]", "/pricing"]
    )

    const { source } = await generateFileRoutes({ pagesDir, outFile })
    const { writeFile } = await import("node:fs/promises")
    const tmpRoutes = path.join(fixtures, "advanced", "routes.gen.ts")
    await writeFile(tmpRoutes, source, "utf8")
    const loaded = await import(pathToFileUrl(tmpRoutes))
    const manifest = compileRouteTree(loaded.routes)

    const blog = matchRoute(manifest, "/blog/hello")
    assert.ok(blog)
    assert.strictEqual(blog!.params.slug, "hello")

    const pricing = matchRoute(manifest, "/pricing")
    assert.ok(pricing)

    const docs = matchRoute(manifest, "/docs/a/b")
    assert.ok(docs)
    assert.strictEqual(docs!.params.slug, "a/b")
  })

  it("ignores routes under _private segments", async () => {
    const pagesDir = path.join(fixtures, "advanced", "pages")
    const outFile = path.join(fixtures, "advanced", "routes.gen.ts")
    const { routes } = await generateFileRoutes({ pagesDir, outFile })
    assert.ok(!routes.has("/ignored"))
  })

  it("merges extendRoutes into generated tree", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises")
    const pagesDir = path.join(fixtures, "basic", "pages")
    const outFile = path.join(fixtures, "basic", "routes.gen.ts")
    const extendFile = path.join(fixtures, "basic", "routes.extend.ts")
    await mkdir(path.dirname(extendFile), { recursive: true }).catch(() => {})
    await writeFile(
      extendFile,
      `import { createRoute } from "kiru/router"
export const extendRoutes = [
  createRoute("/manual", () => import("./manual-page")),
] as const
`
    )
    const { source } = await generateFileRoutes({
      pagesDir,
      outFile,
      extend: extendFile,
    })
    assert.ok(source.includes("...extendRoutes"))
    assert.ok(source.includes("import { extendRoutes }"))
    assert.ok(source.includes("...(typeof extendRoutes)"))
    assert.ok(!source.includes("interface ExtendedRouteTree"))
  })

  it("generates route and scope config spreads", async () => {
    const pagesDir = path.join(fixtures, "config", "pages")
    const outFile = path.join(fixtures, "config", "routes.gen.ts")
    const { source } = await generateFileRoutes({ pagesDir, outFile })

    assert.ok(source.includes("page.config"))
    assert.ok(source.includes("...resolveRouteConfig(__cfg_"))
    assert.ok(!source.includes("_export"))
    assert.ok(!source.match(/__cfg_\d+\.config\b/))
    assert.ok(source.includes("scope.config"))
    assert.ok(source.includes("static: true") || source.includes("__cfg_"))
    assert.ok(source.includes("satisfies RoutePageConfig") === false)
    assert.ok(source.includes("createRoute(\"/about\", {"))
    assert.ok(source.includes("createRouteScope({"))

    const { writeFile } = await import("node:fs/promises")
    await writeFile(outFile, source, "utf8")
    const loaded = await import(pathToFileUrl(outFile))
    const manifest = compileRouteTree(loaded.routes)
    const about = matchRoute(manifest, "/about")!
    assert.equal(about.route.static, true)
    assert.equal(about.route.head.title, "About (config)")
    const admin = matchRoute(manifest, "/admin")!
    assert.equal(admin.route.meta.requiresAuth, true)
  })

  it("rejects catch-all not at end of filesystem path", async () => {
    const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const dir = await mkdtemp(path.join(tmpdir(), "kiru-fbr-"))
    const pagesDir = path.join(dir, "pages")
    await mkdir(path.join(pagesDir, "[...slug]", "extra"), { recursive: true })
    await writeFile(
      path.join(pagesDir, "[...slug]", "extra", "page.tsx"),
      "export default null\n"
    )
    await assert.rejects(
      () =>
        generateFileRoutes({
          pagesDir,
          outFile: path.join(dir, "routes.gen.ts"),
        }),
      /Catch-all/
    )
  })
})

function pathToFileUrl(p: string): string {
  return new URL(`file:///${p.replace(/\\/g, "/")}`).href
}
