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
  owner: InterceptorRegistration["owner"],
  targetPath: string,
  id: number
): InterceptorRegistration {
  return {
    id,
    owner,
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

  it("matches route owner and target path pattern", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    const found = findMatchingInterceptor(
      [reg({ kind: "route", routeId: from.route.id }, "/photos/[id]", 1)],
      from,
      to
    )
    assert.ok(found)
    assert.equal(found.id, 1)
  })

  it("matches scope owner from any leaf in scope", () => {
    const manifestWithLayout = compileRouteTree(
      createRouteTree({
        layout: async () => ({
          default: () => null,
          interceptors: undefined,
        }),
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/photos", async () => ({ default: () => null })),
          createRoute("/photos/[id]", async () => ({ default: () => null })),
        ],
      })
    )
    const from = matchRoute(manifestWithLayout, "/", { baseUrl: "" })!
    const to = matchRoute(manifestWithLayout, "/photos/abc", { baseUrl: "" })!
    const scopeId = from.route.scopes[0]!.id
    const found = findMatchingInterceptor(
      [reg({ kind: "scope", scopeId }, "/photos/[id]", 2)],
      from,
      to
    )
    assert.ok(found)
    assert.equal(found.id, 2)
  })

  it("prefers route owner over scope owner for same target", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    const scopeId = from.route.scopes[0]?.id ?? "scope:0"
    const found = findMatchingInterceptor(
      [
        reg({ kind: "scope", scopeId }, "/photos/[id]", 1),
        reg({ kind: "route", routeId: from.route.id }, "/photos/[id]", 2),
      ],
      from,
      to
    )
    assert.ok(found)
    assert.equal(found.id, 2)
  })

  it("returns null when owner does not match from route", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    assert.equal(
      findMatchingInterceptor(
        [reg({ kind: "route", routeId: "route:999" }, "/photos/[id]", 1)],
        from,
        to
      ),
      null
    )
  })

  it("returns null when target path pattern differs", () => {
    const from = matchRoute(manifest, "/photos", { baseUrl: "" })!
    const to = matchRoute(manifest, "/photos/abc", { baseUrl: "" })!
    assert.equal(
      findMatchingInterceptor(
        [reg({ kind: "route", routeId: from.route.id }, "/photos/other", 1)],
        from,
        to
      ),
      null
    )
  })
})
