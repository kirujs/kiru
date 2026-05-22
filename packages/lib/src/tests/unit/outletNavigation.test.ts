import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { signal } from "../../signals/index.js"
import {
  canEndClientNavigation,
  tryClearClientNavigation,
} from "../../router/outletNavigation.js"
import type { CurrentNavigation, RouteMatch } from "../../router/types.js"

function stubRouter(overrides: {
  pathname?: string
  match?: RouteMatch | null
  nav?: CurrentNavigation | null
  isNavigating?: boolean
}) {
  return {
    pathname: signal(overrides.pathname ?? "/"),
    match: signal<RouteMatch | null>(overrides.match ?? null),
    currentNavigation: signal<CurrentNavigation | null>(overrides.nav ?? null),
    isNavigating: signal(overrides.isNavigating ?? true),
  }
}

describe("outletNavigation", () => {
  it("canEndClientNavigation when pathname matches nav target", () => {
    const router = stubRouter({
      pathname: "/about",
      nav: {
        from: null,
        to: { pathname: "/about", hash: "", query: {}, params: {} },
      },
    })
    assert.equal(canEndClientNavigation(router), true)
  })

  it("canEndClientNavigation is false when pathname differs", () => {
    const router = stubRouter({
      pathname: "/",
      nav: {
        from: null,
        to: { pathname: "/about", hash: "", query: {}, params: {} },
      },
    })
    assert.equal(canEndClientNavigation(router), false)
  })

  it("tryClearClientNavigation clears isNavigating when navigation can end", () => {
    const router = stubRouter({
      pathname: "/",
      nav: {
        from: null,
        to: { pathname: "/", hash: "", query: {}, params: {} },
      },
      isNavigating: true,
    })
    tryClearClientNavigation(router)
    assert.equal(router.isNavigating.peek(), false)
    assert.equal(router.currentNavigation.peek(), null)
  })
})
