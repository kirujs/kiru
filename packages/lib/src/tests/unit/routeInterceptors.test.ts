import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { matchRoute } from "../../router/manifest.js"
import {
  findMatchingInterceptor,
  type InterceptorRegistration,
} from "../../router/routeInterceptors.js"

function reg(
  fromRouteId: string,
  targetPath: string,
  id: number
): InterceptorRegistration {
  return {
    id,
    fromRouteId,
    targetPath,
    render: () => null,
    isActive: {
      peek: () => false,
      value: false,
    } as InterceptorRegistration["isActive"],
    isPending: {
      peek: () => false,
      value: false,
    } as InterceptorRegistration["isPending"],
  }
}

describe("findMatchingInterceptor", () => {
  const manifest = compileRouteTree(
    createRouteTree({
      children: [
        createRoute("/photos", async () => ({ default: () => null })),
        createRoute("/photos/[id]", async () => ({ default: () => null })),
      ],
    })
  )

  it("matches from route id and target path pattern", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    const found = findMatchingInterceptor(
      [reg(from.route.id, "/photos/[id]", 1)],
      from,
      to
    )
    assert.ok(found)
    assert.equal(found.id, 1)
  })

  it("returns null when from route id differs", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    assert.equal(
      findMatchingInterceptor([reg("route:999", "/photos/[id]", 1)], from, to),
      null
    )
  })

  it("returns null when target path pattern differs", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    assert.equal(
      findMatchingInterceptor(
        [reg(from.route.id, "/photos/other", 1)],
        from,
        to
      ),
      null
    )
  })
})
