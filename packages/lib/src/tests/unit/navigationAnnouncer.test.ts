import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import {
  announceNavigationIfReady,
  ensureRouteAnnouncerInDocument,
  resetNavigationAnnouncerStateForTests,
  ROUTE_ANNOUNCER_LIVE_REGION_ID,
  ROUTE_ANNOUNCER_TAG,
} from "../../router/navigationAnnouncer.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"
import { withJSDOM } from "./jsdom.js"

function getLiveRegion(): HTMLElement | null {
  const host = document.querySelector(ROUTE_ANNOUNCER_TAG)
  return host?.shadowRoot?.getElementById(ROUTE_ANNOUNCER_LIVE_REGION_ID) ?? null
}

describe("navigationAnnouncer", () => {
  afterEach(() => {
    resetNavigationAnnouncerStateForTests()
  })

  it("ensureRouteAnnouncerInDocument appends host with shadow live region", async () => {
    await withJSDOM(async () => {
      ensureRouteAnnouncerInDocument(true)
      const host = document.querySelector(ROUTE_ANNOUNCER_TAG) as HTMLElement
      assert.ok(host)
      assert.equal(host.style.position, "absolute")
      const region = getLiveRegion()
      assert.ok(region)
      assert.equal(region?.getAttribute("role"), "alert")
      assert.equal(region?.getAttribute("aria-live"), "assertive")
      assert.equal(region?.id, ROUTE_ANNOUNCER_LIVE_REGION_ID)
    })
  })

  it("ensureRouteAnnouncerInDocument is a no-op when disabled", async () => {
    await withJSDOM(async () => {
      ensureRouteAnnouncerInDocument(false)
      assert.equal(document.querySelector(ROUTE_ANNOUNCER_TAG), null)
    })
  })

  it("createRouter appends announcer when navigationAnnouncer is enabled", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [createRoute("/", async () => ({ default: () => null }))],
        })
      )
      createRouter({ routes: manifest })
      assert.ok(document.querySelector(ROUTE_ANNOUNCER_TAG))
    })
  })

  it("announces document.title after successful navigation with prior route", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [
            createRoute("/a", async () => ({ default: () => null })),
            createRoute("/b", async () => ({ default: () => null })),
          ],
        })
      )
      const router = createRouter({ routes: manifest })

      document.title = "Page A"
      getRouterInstanceRuntime(router).setLastNavigation({
        to: { pathname: "/a", params: {} },
        from: null,
      })
      announceNavigationIfReady(router)
      assert.equal(getLiveRegion()?.textContent, "")

      document.title = "Page B"
      router.pathname.value = "/b"
      getRouterInstanceRuntime(router).setLastNavigation({
        to: { pathname: "/b", params: {} },
        from: { pathname: "/a", params: {} },
      })
      announceNavigationIfReady(router)
      assert.equal(getLiveRegion()?.textContent, "Page B")
    })
  })

  it("does not announce when navigationAnnouncer is disabled", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [createRoute("/", async () => ({ default: () => null }))],
        })
      )
      const router = createRouter({
        routes: manifest,
        navigationAnnouncer: false,
      })
      assert.equal(document.querySelector(ROUTE_ANNOUNCER_TAG), null)
      document.title = "Silent"
      getRouterInstanceRuntime(router).setLastNavigation({
        to: { pathname: "/", params: {} },
        from: { pathname: "/x", params: {} },
      })
      announceNavigationIfReady(router)
      assert.equal(getLiveRegion(), null)
    })
  })

  it("does not announce when last navigation has failure", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [createRoute("/", async () => ({ default: () => null }))],
        })
      )
      const router = createRouter({ routes: manifest })
      document.title = "Failed"
      getRouterInstanceRuntime(router).setLastNavigation({
        to: { pathname: "/", params: {} },
        from: { pathname: "/x", params: {} },
        failure: { type: "cancelled" },
      })
      announceNavigationIfReady(router)
      assert.equal(getLiveRegion()?.textContent, "")
    })
  })
})
