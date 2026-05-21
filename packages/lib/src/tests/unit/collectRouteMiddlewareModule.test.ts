import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { collectRouteMiddlewareModule } from "../../router/routeMiddleware.js"
import type { RouteMiddleware } from "../../router/types.js"

describe("collectRouteMiddlewareModule", () => {
  const a: RouteMiddleware = () => {}
  const b: RouteMiddleware = () => {}
  const c: RouteMiddleware = () => {}

  it("collects a single default export", () => {
    assert.deepEqual(collectRouteMiddlewareModule({ default: a }), [a])
  })

  it("collects a default export array", () => {
    assert.deepEqual(collectRouteMiddlewareModule({ default: [a, b] }), [a, b])
  })

  it("collects named middleware export", () => {
    assert.deepEqual(collectRouteMiddlewareModule({ middleware: c }), [c])
  })

  it("collects named middleware array", () => {
    assert.deepEqual(collectRouteMiddlewareModule({ middleware: [b, c] }), [
      b,
      c,
    ])
  })

  it("merges default then named middleware", () => {
    assert.deepEqual(
      collectRouteMiddlewareModule({ default: a, middleware: [b, c] }),
      [a, b, c]
    )
  })
})
