import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import { getKiruRouter } from "../../router/routerGlobal.js"
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
        const router = getKiruRouter()
        assert.ok(router)
        const result = await router.navigate("/forbidden")
        assert.equal(result.status, "errored")
        assert.equal(router.pathname.peek(), "/forbidden")
        await new Promise((r) => setTimeout(r, 50))
        const outletText = container.textContent ?? ""
        assert.match(outletText, /Forbidden/)
        assert.doesNotMatch(outletText, /forbidden-page-should-not-render/)
        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })
})
