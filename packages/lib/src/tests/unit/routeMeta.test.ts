import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import { defineRouteTree } from "../../router/defineRouteTree.js"
import {
  effectiveContextPendingFallback,
  effectiveContextStrategy,
  mergeRouteMeta,
  shouldAwaitContext,
  shouldBlockOutlet,
  shouldResolveContext,
} from "../../router/routeMeta.js"

declare module "kiru/router" {
  interface RouteMeta {
    appFlag?: boolean
  }
}

describe("routeMeta", () => {
  const tree = defineRouteTree((r) =>
    r.scope({
      meta: { appFlag: true },
      contextStrategy: "none",
      children: [
        r.scope({
          contextStrategy: "block",
          meta: { appFlag: false },
          children: [
            r.page("/child", {
              component: async () => ({ default: () => null }),
            }),
          ],
        }),
        r.page("/leaf", {
          meta: { appFlag: true },
          component: async () => ({ default: () => null }),
        }),
      ],
    })
  )

  it("mergeRouteMeta shallow-merges scopes and route", () => {
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/leaf")!
    assert.equal(mergeRouteMeta(match).appFlag, true)
  })

  it("effectiveContextStrategy uses nearest scope", () => {
    const manifest = compileRouteTree(tree)
    const child = matchRoute(manifest, "/child")!
    assert.equal(effectiveContextStrategy(child), "block")
    const leaf = matchRoute(manifest, "/leaf")!
    assert.equal(effectiveContextStrategy(leaf), "none")
  })

  it("effectiveContextPendingFallback uses nearest scope then app default", () => {
    const appFb = () => "app"
    const scopeFb = () => "scope"
    const tree = defineRouteTree((r) =>
      r.scope({
        children: [
          r.scope({
            contextPendingFallback: scopeFb,
            children: [
              r.page("/scoped", {
                component: async () => ({ default: () => null }),
              }),
            ],
          }),
          r.page("/plain", {
            component: async () => ({ default: () => null }),
          }),
        ],
      })
    )
    const manifest = compileRouteTree(tree)
    assert.equal(
      effectiveContextPendingFallback(
        matchRoute(manifest, "/scoped")!,
        appFb
      ),
      scopeFb
    )
    assert.equal(
      effectiveContextPendingFallback(matchRoute(manifest, "/plain")!, appFb),
      appFb
    )
  })

  it("shouldBlockOutlet respects contextStrategy none and off inherit", () => {
    const manifest = compileRouteTree(tree)
    const leaf = matchRoute(manifest, "/leaf")!
    const opts = { contextGate: "off" as const, hasResolveContext: true }
    assert.equal(shouldBlockOutlet(leaf, opts), false)
    assert.equal(shouldResolveContext(leaf, opts), false)
    const child = matchRoute(manifest, "/child")!
    assert.equal(shouldBlockOutlet(child, opts), true)
    assert.equal(shouldResolveContext(child, opts), true)
  })

  describe("contextGate block", () => {
    const inheritOnly = defineRouteTree((r) =>
      r.scope({
        children: [
          r.page("/plain", {
            component: async () => ({ default: () => null }),
          }),
        ],
      })
    )

    it("treats inherit routes as block for outlet, resolve, and await", () => {
      const match = matchRoute(compileRouteTree(inheritOnly), "/plain")!
      const opts = { contextGate: "block" as const, hasResolveContext: true }
      assert.equal(effectiveContextStrategy(match, "block"), "block")
      assert.equal(shouldBlockOutlet(match, opts), true)
      assert.equal(shouldResolveContext(match, opts), true)
      assert.equal(shouldAwaitContext(match, opts), true)
    })

    it("does not override explicit scope contextStrategy", () => {
      const manifest = compileRouteTree(tree)
      const leaf = matchRoute(manifest, "/leaf")!
      const opts = { contextGate: "block" as const, hasResolveContext: true }
      assert.equal(effectiveContextStrategy(leaf, "block"), "none")
      assert.equal(shouldBlockOutlet(leaf, opts), false)
      assert.equal(shouldResolveContext(leaf, opts), false)
    })

    it("off leaves inherit routes open", () => {
      const match = matchRoute(compileRouteTree(inheritOnly), "/plain")!
      const opts = { contextGate: "off" as const, hasResolveContext: true }
      assert.equal(effectiveContextStrategy(match, "off"), "inherit")
      assert.equal(shouldBlockOutlet(match, opts), false)
      assert.equal(shouldResolveContext(match, opts), false)
      assert.equal(shouldAwaitContext(match, opts), false)
    })
  })
})
