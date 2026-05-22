import { describe, it, beforeEach } from "node:test"
import assert from "node:assert/strict"
import {
  appendHydrationPreloadsToHeadHtml,
  appendModulePreloadsToHeadHtml,
  collectChunkUrlsForMatch,
  renderModulePreloadLinks,
  resetInjectedModulePreloadsForTests,
  resolveEntryBootstrapUrls,
  resolveModuleChunkUrls,
  routePreloadUrlsExcludingBootstrap,
  type HydrationChunksManifest,
} from "../../router/hydrationChunks.js"
import type { RouteMatch } from "../../router/types.js"

const sampleViteManifest = {
  "src/pages/index.tsx": {
    file: "assets/index-page.js",
    imports: ["_shared.js", "index.html"],
  },
  "src/pages/layout.tsx": {
    file: "assets/layout.js",
    imports: ["_shared.js"],
  },
  "_shared.js": {
    file: "assets/shared.js",
    imports: ["index.html"],
  },
  "index.html": {
    file: "assets/entry.js",
    isEntry: true,
    imports: ["_shared.js"],
  },
} as const

describe("hydrationChunks", () => {
  beforeEach(() => {
    resetInjectedModulePreloadsForTests()
  })

  it("resolveModuleChunkUrls walks imports and skips index.html", () => {
    const urls = resolveModuleChunkUrls(
      sampleViteManifest as unknown as Record<
        string,
        { file?: string; imports?: string[] }
      >,
      "src/pages/index.tsx"
    )
    assert.ok(urls.includes("/assets/index-page.js"))
    assert.ok(urls.includes("/assets/shared.js"))
    assert.ok(!urls.includes("/assets/entry.js"))
  })

  it("collectChunkUrlsForMatch prefers byRouteId", () => {
    const match = {
      route: { id: "route:1", path: "/about" },
      params: {},
      pathname: "/about",
    } as RouteMatch
    const manifest: HydrationChunksManifest = {
      version: 1,
      modules: {},
      byRouteId: { "route:1": ["/assets/about.js"] },
      byPathname: { "/about": ["/assets/other.js"] },
    }
    assert.deepEqual(collectChunkUrlsForMatch(match, manifest), [
      "/assets/about.js",
    ])
  })

  it("renderModulePreloadLinks dedupes across calls", () => {
    const a = renderModulePreloadLinks(["/assets/a.js"])
    const b = renderModulePreloadLinks(["/assets/a.js", "/assets/b.js"])
    assert.match(a, /href="\/assets\/a\.js"/)
    assert.match(b, /href="\/assets\/b\.js"/)
    assert.doesNotMatch(b, /href="\/assets\/a\.js"/)
  })

  it("resolveEntryBootstrapUrls collects entry static imports excluding entry", () => {
    const urls = resolveEntryBootstrapUrls(
      sampleViteManifest as unknown as Record<
        string,
        { file?: string; imports?: string[]; isEntry?: boolean }
      >
    )
    assert.ok(urls.includes("/assets/shared.js"))
    assert.ok(!urls.includes("/assets/entry.js"))
  })

  it("appendHydrationPreloadsToHeadHtml emits bootstrap before route with low priority", () => {
    const out = appendHydrationPreloadsToHeadHtml("<meta />", {
      bootstrap: ["/assets/shared.js"],
      route: ["/assets/shared.js", "/assets/page.js"],
    })
    const bootIdx = out.indexOf('fetchpriority="low"')
    const pageIdx = out.indexOf("/assets/page.js")
    assert.ok(bootIdx >= 0)
    assert.ok(pageIdx > bootIdx)
    assert.deepEqual(
      routePreloadUrlsExcludingBootstrap(
        ["/assets/shared.js", "/assets/page.js"],
        ["/assets/shared.js"]
      ),
      ["/assets/page.js"]
    )
  })

  it("appendModulePreloadsToHeadHtml appends link tags", () => {
    const out = appendModulePreloadsToHeadHtml("<meta />", [
      "/assets/page.js",
    ])
    assert.match(out, /rel="modulepreload"/)
    assert.match(out, /\/assets\/page\.js/)
  })
})
