import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildHydrationChunksManifest,
  parseRouteModuleBindings,
  resolveModuleChunkUrls,
} from "./hydrationChunks.js"
import { compileRouteTree, createRoute, createRouteTree } from "kiru/router"

const viteManifest = {
  "src/pages/index.tsx": {
    file: "assets/index-page.js",
    imports: ["_shared.js", "src/pages/layout.tsx"],
  },
  "src/pages/about.tsx": {
    file: "assets/about.js",
    imports: ["src/pages/layout.tsx"],
  },
  "src/pages/layout.tsx": {
    file: "assets/layout.js",
    imports: ["_shared.js"],
  },
  "_shared.js": { file: "assets/shared.js" },
  "index.html": {
    file: "assets/entry.js",
    isEntry: true,
    imports: ["_shared.js"],
  },
}

describe("hydrationChunks (vite-plugin)", () => {
  it("parseRouteModuleBindings extracts layout and pages", () => {
    const src = `
      export const routes = createRouteTree({
        layout: () => import("./pages/layout.tsx"),
        children: [
          createRoute("/", { component: () => import("./pages/index.tsx") }),
          createRoute("/about", { component: () => import("./pages/about") }),
        ],
      })
    `
    const bindings = parseRouteModuleBindings(
      src,
      "/app/src/routes.ts",
      "/app"
    )
    assert.equal(bindings.length, 2)
    assert.ok(bindings[0]!.layoutModuleKeys.includes("src/pages/layout.tsx"))
    assert.equal(bindings[1]!.pageModuleKey, "src/pages/about.tsx")
  })

  it("buildHydrationChunksManifest maps route ids to chunk urls", () => {
    const routes = createRouteTree({
      layout: () => import("./pages/layout.tsx"),
      children: [
        createRoute("/", { component: () => import("./pages/index.tsx") }),
        createRoute("/about", { component: () => import("./pages/about.tsx") }),
      ],
    })
    const routeManifest = compileRouteTree(routes)
    const bindings = parseRouteModuleBindings(
      `createRouteTree({ layout: () => import("./pages/layout.tsx"), children: [
        createRoute("/", { component: () => import("./pages/index.tsx") }),
        createRoute("/about", { component: () => import("./pages/about.tsx") }),
      ]})`,
      "/app/src/routes.ts",
      "/app"
    )
    const manifest = buildHydrationChunksManifest({
      viteManifest,
      routes: routeManifest.routes,
      routeBindings: bindings,
    })
    const about = routeManifest.routes.find((r) => r.path === "/about")
    assert.ok(about)
    const urls = manifest.byRouteId[about!.id]
    assert.ok(urls?.includes("/assets/about.js"))
    assert.ok(urls?.includes("/assets/layout.js"))
    assert.ok(!urls?.includes("/assets/entry.js"))
    assert.ok(manifest.bootstrap?.includes("/assets/shared.js"))
    assert.ok(!manifest.bootstrap?.includes("/assets/entry.js"))
  })

  it("resolveModuleChunkUrls follows import graph", () => {
    const urls = resolveModuleChunkUrls(viteManifest, "src/pages/index.tsx")
    assert.ok(urls.includes("/assets/index-page.js"))
    assert.ok(urls.includes("/assets/layout.js"))
  })
})
