import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { createElement } from "../../element.js"
import { mount } from "../../appHandle.js"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
  RouterProvider,
} from "../../router/index.js"
import {
  claimActiveRouter,
  getActiveRouter,
  releaseActiveRouter,
} from "../../router/routerGlobal.js"
import { withJSDOM } from "./jsdom.js"

describe("active router (single RouterProvider per page)", () => {
  afterEach(() => {
    const active = getActiveRouter()
    if (active) releaseActiveRouter(active)
  })

  it("claimActiveRouter throws when a second distinct router is claimed", async () => {
    await withJSDOM(async () => {
      const routes = createRouteTree({
        children: [createRoute("/", async () => ({ default: () => null }))],
      })
      const manifest = compileRouteTree(routes)
      const first = createRouter({ routes: manifest })
      const second = createRouter({ routes: manifest })
      claimActiveRouter(first)
      assert.throws(
        () => claimActiveRouter(second),
        /Only one RouterProvider is supported per page/
      )
      releaseActiveRouter(first)
      assert.doesNotThrow(() => claimActiveRouter(second))
    })
  })

  it("RouterProvider releases the active slot on unmount", async () => {
    await withJSDOM(async (container) => {
      const routes = createRouteTree({
        children: [createRoute("/", async () => ({ default: () => null }))],
      })
      const manifest = compileRouteTree(routes)
      const first = createRouter({ routes: manifest })
      const app = mount(
        createElement(RouterProvider, {
          router: first,
          children: null,
        }),
        container
      )
      assert.equal(getActiveRouter(), first)
      app.unmount()
      assert.equal(getActiveRouter(), undefined)
    })
  })

  it("allows a new router after the previous Provider unmounts", async () => {
    await withJSDOM(async (container) => {
      const routes = createRouteTree({
        children: [createRoute("/", async () => ({ default: () => null }))],
      })
      const manifest = compileRouteTree(routes)
      const first = createRouter({ routes: manifest })
      mount(
        createElement(RouterProvider, { router: first, children: null }),
        container
      ).unmount()
      const second = createRouter({ routes: manifest })
      assert.doesNotThrow(() =>
        mount(
          createElement(RouterProvider, { router: second, children: null }),
          container
        )
      )
      assert.equal(getActiveRouter(), second)
    })
  })
})
