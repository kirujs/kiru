import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import {
  createRoute,
  createRouteScope,
  createRouteTree,
} from "../../router/createRouteTree.js"
import { collectMiddlewareChain, mergeRouteMeta } from "../../router/routeMeta.js"

declare module "kiru/router" {
  interface RouteMeta {
    appFlag?: boolean
  }
}

describe("routeMeta", () => {
  const tree = createRouteTree({
    meta: { appFlag: true },
    children: [
      createRouteScope({
        meta: { appFlag: false },
        children: [
          createRoute("/child", {
            component: async () => ({ default: () => null }),
          }),
        ],
      }),
      createRoute("/leaf", {
        meta: { appFlag: true },
        component: async () => ({ default: () => null }),
      }),
    ],
  })

  it("mergeRouteMeta shallow-merges scopes and route", () => {
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/leaf")!
    assert.equal(mergeRouteMeta(match).appFlag, true)
  })

  it("collectMiddlewareChain orders scope then route middleware", () => {
    const scopeMw = () => {}
    const routeMw = () => {}
    const tree = createRouteTree({
      middleware: [scopeMw],
      children: [
        createRoute("/x", {
          component: async () => ({ default: () => null }),
          middleware: [routeMw],
        }),
      ],
    })
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/x")!
    const chain = collectMiddlewareChain(match)
    assert.equal(chain.length, 2)
    assert.equal(chain[0], scopeMw)
    assert.equal(chain[1], routeMw)
  })
})
