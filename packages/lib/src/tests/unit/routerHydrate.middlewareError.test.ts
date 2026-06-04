import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import { getActiveRouter } from "../../router/routerGlobal.js"
import { RouteMiddlewareHttpError } from "../../router/types.js"
import { withJSDOM } from "./jsdom.js"

describe("bootstrapSsrClient middleware errors", () => {
  it("renders error outlet after navigate to route with middleware { error: 403 }", async () => {
    const routes = createRouteTree({
      error: async () => ({
        default: ({ error }: { error: Error }) => error.message,
      }),
      children: [
        createRoute("/", async () => ({ default: () => "home" })),
        createRoute("/forbidden", {
          component: async () => ({
            default: () => "forbidden-page-should-not-render",
          }),
          middleware: [() => ({ error: 403, body: "Forbidden" })],
        }),
      ],
    })
    const manifest = compileRouteTree(routes)

    await withJSDOM(
      async (container) => {
        const app = await bootstrapSsrClient({
          routes: manifest,
          container,
        })
        const router = getActiveRouter()
        assert.ok(router)
        const result = await router.navigate("/forbidden")
        assert.equal(result.status, "errored")
        assert.equal(router.pathname.peek(), "/forbidden")
        const err = router.outletRenderError.peek()
        assert.ok(err instanceof RouteMiddlewareHttpError)
        assert.match(err.message, /Forbidden/)
        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })
})
