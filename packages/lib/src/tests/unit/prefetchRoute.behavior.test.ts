import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  createRouter,
  loader,
} from "../../router/index.js"
import { prefetchRoute } from "../../router/prefetchRoute.js"

describe("prefetchRoute", () => {
  const pathPolicy = { baseUrl: "", trailingSlash: "never" as const }

  it("does not run loader when search validation redirects", async () => {
    let loadCalls = 0
    const pageLoad = loader({
      validation: {
        query: {
          parse(input: unknown) {
            if (
              typeof input !== "object" ||
              input === null ||
              !("q" in input)
            ) {
              throw new Error("bad")
            }
            return input as { q: string }
          },
        },
        queryDefaults: { q: "default" },
        redirectToCanonical: true,
      },
      load: async () => {
        loadCalls += 1
        return {}
      },
    })
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/search", {
            component: async () => ({
              default: () => null,
              load: pageLoad,
            }),
          }),
        ],
      })
    )
    const router = createRouter({
      routes: manifest,
      history: { pushState() {}, replaceState() {} } as any as History,
      location: {
        pathname: "/",
        search: "",
        hash: "",
        origin: "http://localhost",
      } as Location,
    })
    await prefetchRoute({
      manifest,
      href: "/search",
      baseUrl: "",
      router,
      chunks: false,
      data: true,
    })
    assert.equal(loadCalls, 0)
  })

  it("runs client loader when search validates", async () => {
    let loadCalls = 0
    const pageLoad = loader({
      validation: {
        query: {
          parse(input: unknown) {
            if (
              typeof input !== "object" ||
              input === null ||
              !("q" in input)
            ) {
              throw new Error("bad")
            }
            return input as { q: string }
          },
        },
      },
      load: async () => {
        loadCalls += 1
        return { ok: true }
      },
    })
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/ready", {
            component: async () => ({
              default: () => null,
              load: pageLoad,
            }),
          }),
        ],
      })
    )
    const router = createRouter({
      routes: manifest,
      history: { pushState() {}, replaceState() {} } as any as History,
      location: {
        pathname: "/",
        search: "?q=ok",
        hash: "",
        origin: "http://localhost",
      } as Location,
      pathPolicy,
    })
    await prefetchRoute({
      manifest,
      href: "/ready?q=ok",
      baseUrl: "",
      router,
      chunks: false,
      data: true,
    })
    assert.equal(loadCalls, 1)
  })
})
