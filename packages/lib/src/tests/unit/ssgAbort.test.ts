import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { prerenderStaticRoutes } from "../../router/ssg.js"
import { isAbortError } from "../../router/navigationScope.js"

describe("prerenderStaticRoutes abort", () => {
  it("throws AbortError when signal is already aborted", async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const routes = createRouteTree({
        children: [
          createRoute("/", async () => ({
            default: () => null,
          })),
        ],
      })
    await assert.rejects(
      () =>
        prerenderStaticRoutes({
          routes,
          signal: ctrl.signal,
        }),
      (err) => isAbortError(err)
    )
  })
})
