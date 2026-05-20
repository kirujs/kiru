import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import { defineRouteTree } from "../../router/defineRouteTree.js"
import { buildMiddlewareTo } from "../../router/navigation.js"
import { runRouteMiddleware } from "../../router/routeMiddleware.js"
import { mergeRouteMeta } from "../../router/routeMeta.js"

describe("runRouteMiddleware", () => {
  it("runs global then scope then route middleware in order", async () => {
    const order: string[] = []
    const tree = defineRouteTree((r) =>
      r.scope({
        middleware: [
          () => {
            order.push("scope")
          },
        ],
        children: [
          r.page("/", {
            middleware: [
              () => {
                order.push("route")
              },
            ],
            component: async () => ({ default: () => null }),
          }),
        ],
      })
    )
    const manifest = compileRouteTree(tree)
    const match = matchRoute(manifest, "/")!
    await runRouteMiddleware({
      to: buildMiddlewareTo(
        { pathname: "/", hash: "", query: {}, href: "/" },
        match,
        []
      ),
      from: null,
      meta: mergeRouteMeta(match),
      context: {},
      globalMiddleware: [
        () => {
          order.push("global")
        },
      ],
      match,
    })
    assert.deepEqual(order, ["global", "scope", "route"])
  })

  it("returns redirect when middleware redirects", async () => {
    const manifest = compileRouteTree(
      defineRouteTree((r) =>
        r.scope({
          children: [
            r.page("/", {
              component: async () => ({ default: () => null }),
            }),
          ],
        })
      )
    )
    const match = matchRoute(manifest, "/")!
    const out = await runRouteMiddleware({
      to: buildMiddlewareTo(
        { pathname: "/", hash: "", query: {}, href: "/" },
        match,
        []
      ),
      from: null,
      meta: {},
      context: {},
      globalMiddleware: [() => ({ redirect: "/login" })],
      match,
    })
    assert.equal(out.type, "redirect")
  })
})
