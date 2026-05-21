import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import {
  createRoute,
  createRouteScope,
  createRouteTree,
} from "../../router/createRouteTree.js"
import {
  resolveRouteHeadLayer,
  resolveRouteMetaLayer,
  resolveRouteMiddlewareLayer,
} from "../../router/routeLayers.js"
import { collectMiddlewareChain } from "../../router/routeMeta.js"
import type { RouteMiddleware } from "../../router/types.js"
import { mergeRouteMeta } from "../../router/routeMeta.js"

declare module "kiru/router" {
  interface RouteMeta {
    layer?: string
  }
}

describe("routeLayers", () => {
  it("resolveRouteMetaLayer object replaces inherited", () => {
    const out = resolveRouteMetaLayer(
      { layer: "parent" },
      { layer: "child" }
    )
    assert.equal(out.layer, "child")
  })

  it("resolveRouteMetaLayer function extends inherited", () => {
    const out = resolveRouteMetaLayer({ layer: "parent" }, (inherited) => ({
      ...inherited,
      layer: "child",
    }))
    assert.equal(out.layer, "child")
  })

  it("compileRouteTree applies object replace per scope", () => {
    const tree = createRouteTree({
      meta: { layer: "root" },
      children: [
        createRouteScope({
          meta: { layer: "scope-only" },
          children: [
            createRoute("/child", {
              component: async () => ({ default: () => null }),
            }),
          ],
        }),
      ],
    })
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/child")!
    assert.equal(mergeRouteMeta(match).layer, "scope-only")
    assert.equal(match.route.scopes[0]!.meta.layer, "root")
    assert.equal(match.route.scopes[1]!.meta.layer, "scope-only")
  })

  it("compileRouteTree applies meta function on leaf", () => {
    const tree = createRouteTree({
      meta: { layer: "root" },
      children: [
        createRoute("/leaf", {
          meta: (inherited) => ({ ...inherited, layer: "leaf" }),
          component: async () => ({ default: () => null }),
        }),
      ],
    })
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/leaf")!
    assert.equal(mergeRouteMeta(match).layer, "leaf")
  })

  it("resolveRouteHeadLayer object replaces inherited title", () => {
    const out = resolveRouteHeadLayer(
      { title: "Parent" },
      { title: "Child" }
    )
    assert.equal(out.title, "Child")
    assert.equal(out.description, undefined)
  })

  it("resolveRouteHeadLayer function extends inherited", () => {
    const out = resolveRouteHeadLayer({ title: "Parent" }, (inherited) => ({
      ...inherited,
      description: "Child desc",
    }))
    assert.equal(out.title, "Parent")
    assert.equal(out.description, "Child desc")
  })

  it("resolveRouteMiddlewareLayer array replaces inherited", () => {
    const a = () => {}
    const b = () => {}
    const out = resolveRouteMiddlewareLayer([a], [b])
    assert.equal(out.length, 1)
    assert.equal(out[0], b)
  })

  it("resolveRouteMiddlewareLayer function extends inherited", () => {
    const a = () => {}
    const b = () => {}
    const out = resolveRouteMiddlewareLayer(
      [a],
      (inherited: RouteMiddleware[]) => [...inherited, b]
    )
    assert.equal(out.length, 2)
    assert.equal(out[0], a)
    assert.equal(out[1], b)
  })

  it("resolveRouteMiddlewareLayer single handler replaces inherited", () => {
    const a = () => {}
    const b = () => {}
    const out = resolveRouteMiddlewareLayer([a], b)
    assert.deepEqual(out, [b])
  })

  it("compileRouteTree resolves middleware on leaf", () => {
    const rootMw = () => {}
    const leafMw = () => {}
    const tree = createRouteTree({
      middleware: [rootMw],
      children: [
        createRoute("/leaf", {
          middleware: (inherited: RouteMiddleware[]) => [
            ...inherited,
            leafMw,
          ],
          component: async () => ({ default: () => null }),
        }),
      ],
    })
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/leaf")!
    assert.deepEqual(collectMiddlewareChain(match), [rootMw, leafMw])
  })
})
