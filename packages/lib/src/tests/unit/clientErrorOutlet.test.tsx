import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as kiru from "../../index.js"
import { renderToString } from "../../renderToString.js"
import { compileRouteTree, createRoute, createRouteTree } from "../../router/index.js"
import { loader } from "../../router/loaders.js"
import {
  buildRoutedSubtree,
  loadRouteTree,
  renderClientErrorOutlet,
} from "../../router/routeTree.js"
import type { RouteMatch } from "../../router/types.js"

const { createElement } = kiru

describe("client error outlet", () => {
  const errRoutes = createRouteTree({
    error: async () => ({
      default: ({ error }: { error: Error }) =>
        createElement("p", { "data-msg": error.message }, "scope-err"),
    }),
    children: [
      createRoute("/loader-boom", {
        component: async () => ({
          default: () => createElement("p", null, "never"),
          load: loader(async () => {
            throw new Error("loader-boom")
          }),
        }),
      }),
    ],
  })
  it("renderClientErrorOutlet uses scope error module for thrown errors", async () => {
    const manifest = compileRouteTree(errRoutes)
    const match = manifest.routes.find((r) => r.path === "/loader-boom")
    assert.ok(match)
    const m: RouteMatch = {
      route: match,
      params: {},
      pathname: "/loader-boom",
    }
    const el = await renderClientErrorOutlet(manifest, m, new Error("loader-boom"))
    assert.ok(el)
    const html = renderToString(el)
    assert.ok(html.includes('data-msg="loader-boom"'))
    assert.ok(html.includes("scope-err"))
  })

  it("onLeafRenderError captures sync throws from leaf render", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/sync-boom", {
            component: async () => ({
              default: () => {
                throw new Error("sync-boom")
              },
            }),
          }),
        ],
      })
    )
    const route = manifest.routes.find((r) => r.path === "/sync-boom")
    assert.ok(route)
    const match: RouteMatch = {
      route,
      params: {},
      pathname: "/sync-boom",
    }
    const tree = await loadRouteTree(match)
    const captured: unknown[] = []
    const el = buildRoutedSubtree(tree.layoutModules, tree.routeModule, {}, {
      onLeafRenderError: (err) => captured.push(err),
    })
    renderToString(el!)
    assert.equal(captured.length, 1)
    assert.equal((captured[0] as Error).message, "sync-boom")
  })
})
