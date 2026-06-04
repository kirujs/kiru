import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createVNode } from "../../vNode.js"
import { node } from "../../globals.js"
import { claimActiveRouter } from "../../router/routerGlobal.js"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
  defineRouteInterceptors,
  routeInterceptor,
} from "../../router/index.js"

function mockHistory() {
  const history = {
    pushState() {},
    replaceState() {},
    back() {},
    forward() {},
    go() {},
    state: { index: 0 },
    length: 1,
  } as unknown as History
  return { history }
}

describe("defineRouteInterceptors", () => {
  it("registers on Outlet setup and soft-navigates", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const { history } = mockHistory()
    const router = createRouter({
      routes: manifest,
      history,
      location: { pathname: "/photos", search: "", hash: "" } as Location,
    })

    const interceptors = defineRouteInterceptors({
      photo: routeInterceptor("/photos/[id]", {
        render: () => null as unknown as JSX.Element,
      }),
    })

    claimActiveRouter(router)
    const vNode = createVNode("div")
    node.current = vNode
    try {
      interceptors.photo.Outlet({})
    } finally {
      node.current = null
    }

    const result = await router.navigate("/photos/42")
    assert.equal(result.status, "intercepted")
    assert.equal(router.pathname.peek(), "/photos/42")
    assert.equal(router.match.peek()?.route.path, "/photos")
    assert.equal(interceptors.photo.isActive.peek(), true)
    router.dispose()
  })
})
