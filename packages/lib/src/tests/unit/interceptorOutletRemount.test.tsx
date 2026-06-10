import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import * as kiru from "../../index.js"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { defineInterceptors } from "../../router/defineInterceptors.js"
import { getActiveRouter } from "../../router/routerGlobal.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"
import {
  clearStreamedSsrClientState,
  resetHydratedPageData,
} from "../../router/pageData.js"
import { bootstrapSsrClient } from "../../ssr/routerHydrate.js"
import { withJSDOM } from "./jsdom.js"
import { waitForSelector } from "./helpers/hydrationFixtures.js"

const interceptors = defineInterceptors({
  post: {
    path: "/p/[id]",
    render: () => <div data-testid="post-modal">Post modal</div>,
  },
})

function AppLayout() {
  return ({ children }: { children: JSX.Children }) => (
    <div data-testid="layout">{children}</div>
  )
}

describe("interceptor outlet remount after SSR hydrate", () => {
  afterEach(() => {
    resetHydratedPageData()
    clearStreamedSsrClientState()
  })

  it("intercepts post navigation after full-page hydrate and return home", async () => {
    const routes = createRouteTree({
      layout: async () => ({ default: AppLayout, interceptors }),
      children: [
        createRoute("/", {
          component: async () => ({
            default: () => <div data-testid="home">Home</div>,
          }),
        }),
        createRoute("/p/[id]", {
          component: async () => ({
            default: () => <div data-testid="post-page">Post page</div>,
          }),
        }),
      ],
    })

    await withJSDOM(
      async (container) => {
        const script = document.createElement("script")
        script.type = "application/json"
        script.setAttribute("k-page-data", "")
        script.textContent = "null"
        document.head.appendChild(script)

        container.innerHTML =
          '<div data-testid="layout"><div data-testid="post-page">Post page</div></div>'

        const manifest = compileRouteTree(routes)
        const app = await bootstrapSsrClient({
          routes: manifest,
          container,
        })
        await new Promise((resolve) => setTimeout(resolve, 0))

        const router = getActiveRouter()
        assert.ok(router)
        assert.equal(router.match.peek()?.route.path, "/p/[id]")

        const runtime = getRouterInstanceRuntime(router)
        const registrations = runtime.getRouteInterceptorRegistrations?.() ?? []
        assert.ok(
          registrations.length > 0,
          "expected interceptor registrations after post-page hydrate"
        )

        const homeResult = await router.navigate("/")
        assert.equal(homeResult.status, "committed")
        await waitForSelector(container, '[data-testid="home"]', 5000)
        assert.equal(router.match.peek()?.route.path, "/")

        assert.ok(
          (runtime.getRouteInterceptorRegistrations?.() ?? []).length > 0,
          "expected interceptor registrations after navigating home"
        )
        const scopeOutlets = runtime.getScopeInterceptorOutlets?.() ?? {}
        assert.ok(
          Object.keys(scopeOutlets).some((key) => key.includes("/p/[id]")),
          "expected scope interceptor outlet after navigating home"
        )

        const interceptResult = await router.navigate("/p/p-2")
        assert.equal(interceptResult.status, "intercepted")
        assert.equal(router.pathname.peek(), "/p/p-2")
        assert.equal(router.match.peek()?.route.path, "/")
        assert.ok(router.interceptState.peek())
        assert.equal(router.interceptState.peek()!.targetMatch.params.id, "p-2")
        const postReg = (runtime.getRouteInterceptorRegistrations?.() ?? []).find(
          (reg) => reg.targetPath === "/p/[id]"
        )
        assert.ok(postReg?.isActive.value, "post interceptor should be active")
        await waitForSelector(container, '[data-testid="post-modal"]', 5000)

        const hardCommit = await router.navigate("/p/p-2", { intercept: false })
        assert.equal(hardCommit.status, "committed")
        assert.equal(router.match.peek()?.route.path, "/p/[id]")
        assert.equal(router.interceptState.peek(), null)
        await waitForSelector(container, '[data-testid="post-page"]', 5000)
        assert.ok(!container.querySelector('[data-testid="post-modal"]'))

        app.unmount()
      },
      { url: "http://localhost/p/p-1" }
    )
  })
})
