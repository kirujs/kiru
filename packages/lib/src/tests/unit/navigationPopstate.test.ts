import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { buildHistoryHref } from "../../router/navigation.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"
import { withJSDOM } from "./jsdom.js"

describe("popstate cancellation URL restore", () => {
  it("buildHistoryHref includes query and hash", () => {
    assert.equal(
      buildHistoryHref(
        { pathname: "/users", hash: "#top", query: { tag: ["a", "b"] } },
        "/"
      ),
      "/users?tag=a&tag=b#top"
    )
    assert.equal(
      buildHistoryHref(
        { pathname: "/about", hash: "", query: {} },
        "/app"
      ),
      "/app/about"
    )
  })

  it("cancelled popstate restores query and hash via leave guard", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [
            createRoute("/page-a", async () => ({ default: () => null })),
            createRoute("/page-b", async () => ({ default: () => null })),
          ],
        })
      )
      const pageBId = manifest.routes.find((r) => r.path === "/page-b")!.id
      const pushUrls: string[] = []
      const history = window.history
      const origPush = history.pushState.bind(history)
      history.pushState = function (data, unused, url) {
        if (typeof url === "string") pushUrls.push(url)
        return origPush(data, unused, url)
      }

      const router = createRouter({ routes: manifest })
      await router.navigate("/page-a")
      await router.navigate("/page-b?q=x")

      getRouterInstanceRuntime(router).registerComponentGuard("leave", () => false, pageBId)

      window.history.back()
      await new Promise<void>((r) => queueMicrotask(r))
      await new Promise<void>((r) => setTimeout(r, 0))

      assert.equal(router.pathname.value, "/page-b")
      assert.deepEqual(router.query.value, { q: ["x"] })
      assert.ok(
        pushUrls.some((u) => u.includes("/page-b") && u.includes("q=x")),
        `expected restore pushState with full URL, got: ${pushUrls.join(", ")}`
      )
      router.dispose()
    })
  })

  it("cancelled popstate restores URL on middleware abort", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [
            createRoute("/page-a", async () => ({ default: () => null })),
            createRoute("/page-b", async () => ({ default: () => null })),
          ],
          middleware: [
            (ctx) => {
              if (ctx.to.pathname === "/page-a") return { abort: true }
              return
            },
          ],
        })
      )
      const pushUrls: string[] = []
      const history = window.history
      const origPush = history.pushState.bind(history)
      history.pushState = function (data, unused, url) {
        if (typeof url === "string") pushUrls.push(url)
        return origPush(data, unused, url)
      }

      const router = createRouter({ routes: manifest })
      await router.navigate("/page-a")
      await router.setQuery({ tab: ["one"] })
      await router.navigate("/page-b")

      window.history.back()
      await new Promise<void>((r) => setTimeout(r, 0))

      assert.equal(router.pathname.value, "/page-b")
      assert.ok(
        pushUrls.some((u) => u.includes("tab=one")),
        `expected query in restore URL, got: ${pushUrls.join(", ")}`
      )
      router.dispose()
    })
  })
})
