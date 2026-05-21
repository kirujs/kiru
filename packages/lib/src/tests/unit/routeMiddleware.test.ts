import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import {
  createRoute,
  createRouteScope,
  createRouteTree,
} from "../../router/createRouteTree.js"
import { buildMiddlewareTo } from "../../router/navigation.js"
import { runRouteMiddleware } from "../../router/routeMiddleware.js"
import { mergeRouteMeta } from "../../router/routeMeta.js"

describe("runRouteMiddleware", () => {
  it("runs root scope then nested scope then route middleware in order", async () => {
    const order: string[] = []
    const tree = createRouteTree({
        middleware: [
          () => {
            order.push("root")
          },
        ],
        children: [
          createRouteScope({
            middleware: [
              () => {
                order.push("scope")
              },
            ],
            children: [
              createRoute("/", {
                middleware: [
                  () => {
                    order.push("route")
                  },
                ],
                component: async () => ({ default: () => null }),
              }),
            ],
          }),
        ],
      })
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
      match,
    })
    assert.deepEqual(order, ["root", "scope", "route"])
  })

  it("returns redirect when middleware redirects", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
          middleware: [() => ({ redirect: "/login" })],
          children: [
            createRoute("/", {
              component: async () => ({ default: () => null }),
            }),
          ],
        })
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
      match,
    })
    assert.equal(out.type, "redirect")
  })
})
