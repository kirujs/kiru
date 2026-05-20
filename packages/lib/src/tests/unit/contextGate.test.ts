import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import { defineRouteTree } from "../../router/defineRouteTree.js"
import {
  resolvePendingOutletMatch,
  shouldDeferProtectedOutlet,
} from "../../router/contextGate.js"

describe("contextGate outlet defer", () => {
  const tree = defineRouteTree((r) =>
    r.scope({
      contextStrategy: "none",
      children: [
        r.scope({
          contextStrategy: "block",
          children: [
            r.page("/admin", {
              component: async () => ({ default: () => null }),
            }),
          ],
        }),
        r.page("/home", {
          component: async () => ({ default: () => null }),
        }),
      ],
    })
  )
  const manifest = compileRouteTree(tree)

  it("resolvePendingOutletMatch uses navigation target while in flight", () => {
    const home = matchRoute(manifest, "/home")!
    const admin = matchRoute(manifest, "/admin")!
    const resolved = resolvePendingOutletMatch(
      home,
      manifest,
      true,
      "/admin"
    )
    assert.equal(resolved?.pathname, admin.pathname)
  })

  it("shouldDeferProtectedOutlet during pending navigation to block route", () => {
    const home = matchRoute(manifest, "/home")!
    const opts = {
      contextGate: "off" as const,
      hasResolveContext: true,
      manifest,
      isNavigating: true,
      navigationToPathname: "/admin",
      contextState: "pending" as const,
    }
    assert.equal(
      shouldDeferProtectedOutlet(home, { status: "ready", context: {} }, opts),
      true
    )
  })

  it("shouldDeferProtectedOutlet while navigating before contextState pending", () => {
    const home = matchRoute(manifest, "/home")!
    const opts = {
      contextGate: "off" as const,
      hasResolveContext: true,
      manifest,
      isNavigating: true,
      navigationToPathname: "/admin",
      contextState: "idle" as const,
    }
    assert.equal(
      shouldDeferProtectedOutlet(home, { status: "ready", context: {} }, opts),
      true
    )
  })
})
