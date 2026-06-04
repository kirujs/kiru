import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
} from "../../router/index.js"
import { getLoaderDispatch } from "../../router/loaderClient.js"
import {
  buildActionRpcUrl,
  buildLoaderRpcUrl,
} from "../../router/rpcUrl.js"
import {
  claimActiveRouter,
  getActiveRouter,
  releaseActiveRouter,
} from "../../router/routerGlobal.js"
import type { Router } from "../../router/routerInstance.js"
import { resetKiruRouterRuntimeForTests } from "../../kiruRuntime.js"
import { withJSDOM } from "./jsdom.js"

describe("rpcUrl", () => {
  afterEach(() => {
    const active = getActiveRouter()
    if (active) releaseActiveRouter(active)
    resetKiruRouterRuntimeForTests()
  })

  it("buildLoaderRpcUrl uses root path by default", () => {
    assert.equal(
      buildLoaderRpcUrl("users"),
      "/?loader=users%3Aload"
    )
  })

  it("buildLoaderRpcUrl prefixes non-root baseUrl", () => {
    assert.equal(
      buildLoaderRpcUrl("users", "/app"),
      "/app?loader=users%3Aload"
    )
  })

  it("buildActionRpcUrl uses root path by default", () => {
    assert.equal(
      buildActionRpcUrl("route:fn"),
      "/?action=route%3Afn"
    )
  })

  it("buildActionRpcUrl prefixes non-root baseUrl and appends query", () => {
    assert.equal(
      buildActionRpcUrl("route:fn", "/app", "foo=bar"),
      "/app?action=route%3Afn&foo=bar"
    )
  })

  it("resolves baseUrl from registered router when omitted", () => {
    claimActiveRouter({ baseUrl: "/app" } as Router)
    assert.equal(
      buildLoaderRpcUrl("home"),
      "/app?loader=home%3Aload"
    )
    assert.equal(
      buildActionRpcUrl("home:act"),
      "/app?action=home%3Aact"
    )
  })
})

describe("loaderClient dispatch baseUrl", () => {
  const prevFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = prevFetch
    delete (globalThis as Record<string, unknown>).__kiru_router
    resetKiruRouterRuntimeForTests()
  })

  it("POSTs loader RPC to base-aware URL", async () => {
    await withJSDOM(async () => {
      const routes = createRouteTree({
        children: [createRoute("/", async () => ({ default: () => null }))],
      })
      const manifest = compileRouteTree(routes)
      const history = {
        pushState() {},
        replaceState() {},
      } as any as History
      const location = {
        pathname: "/app/",
        search: "",
        hash: "",
        origin: "http://localhost",
      } as any as Location

      const router = createRouter({
        routes: manifest,
        history,
        location,
        pathPolicy: { baseUrl: "/app" },
      })
      claimActiveRouter(router)

      let capturedUrl = ""
      globalThis.fetch = async (input) => {
        capturedUrl = String(input)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const routeId = manifest.routes[0]!.id
      await getLoaderDispatch()(routeId, {
        params: {},
        url: { pathname: "/", search: "", hash: "" },
        query: {},
        context: {},
        meta: {},
        route: { id: routeId },
        signal: new AbortController().signal,
      })

      assert.equal(
        capturedUrl,
        `/app?loader=${encodeURIComponent(`${routeId}:load`)}`
      )
      router.dispose()
    })
  })
})
