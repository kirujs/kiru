import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import {
  createRoute,
  createRouteScope,
  createRouteTree,
} from "../../router/createRouteTree.js"
import {
  buildMatchSegments,
  buildMiddlewareLocation,
} from "../../router/navigation.js"
import { runRouteMiddleware } from "../../router/routeMiddleware.js"

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
            middleware: (inherited) => [
              ...inherited,
              (ctx) => {
                assert.ok(ctx.to.meta)
                order.push("scope")
              },
            ],
            children: [
              createRoute("/", {
                middleware: (inherited) => [
                  ...inherited,
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
    const segments = buildMatchSegments(match)
    await runRouteMiddleware({
      to: buildMiddlewareLocation(
        { pathname: "/", hash: "", query: {}, href: "/" },
        match,
        segments
      ),
      from: null,
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
      to: buildMiddlewareLocation(
        { pathname: "/", hash: "", query: {}, href: "/" },
        match,
        buildMatchSegments(match)
      ),
      from: null,
      context: {},
      match,
    })
    assert.equal(out.type, "redirect")
  })
})
