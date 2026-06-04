import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { tryClearClientNavigation } from "../../router/outletNavigation.js"
import { withJSDOM } from "./jsdom.js"

describe("navigation signals", () => {
  it("sets isNavigating and currentNavigation during slow navigation, then clears", async () => {
    await withJSDOM(async () => {
      let releaseSlowImport!: () => void
      const slowImportGate = new Promise<void>((resolve) => {
        releaseSlowImport = resolve
      })

      const manifest = compileRouteTree(
        createRouteTree({
          children: [
            createRoute("/start", async () => ({ default: () => null })),
            createRoute("/slow", async () => {
              await slowImportGate
              return { default: () => null }
            }),
          ],
        })
      )
      const history = {
        pushState() {},
        replaceState() {},
      } as any as History
      const router = createRouter({
        routes: manifest,
        history,
        location: { pathname: "/start" } as Location,
      })

      const navPromise = router.navigate("/slow")
      await new Promise<void>((r) => setTimeout(r, 0))

      assert.equal(router.isNavigating.peek(), true)
      const active = router.currentNavigation.peek()
      assert.ok(active)
      assert.equal(active.to?.pathname, "/slow")
      assert.equal(active.from?.pathname, "/start")

      releaseSlowImport()
      await navPromise
      tryClearClientNavigation(router)

      assert.equal(router.isNavigating.peek(), false)
      assert.equal(router.currentNavigation.peek(), null)
      assert.equal(router.pathname.peek(), "/slow")
      router.dispose()
    })
  })
})
