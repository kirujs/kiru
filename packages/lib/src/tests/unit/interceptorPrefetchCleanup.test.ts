import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { matchRoute } from "../../router/manifest.js"
import {
  buildInterceptorPrefetchKey,
  clearInterceptorPrefetchForRegistration,
  consumePrefetchedInterceptorData,
  prefetchInterceptorLoad,
  setPrefetchedInterceptorData,
  type InterceptorRegistration,
} from "../../router/routeInterceptors.js"

function reg(id: number): InterceptorRegistration {
  return {
    id,
    fromRouteId: "route:0",
    targetPath: "/photos/[id]",
    load: async () => ({ ok: id }),
    render: () => null,
    isActive: { peek: () => false, value: false } as InterceptorRegistration["isActive"],
    isPending: { peek: () => false, value: false } as InterceptorRegistration["isPending"],
  }
}

describe("clearInterceptorPrefetchForRegistration", () => {
  const manifest = compileRouteTree(
    createRouteTree({
      children: [
        createRoute("/photos", async () => ({ default: () => null })),
        createRoute("/photos/[id]", async () => ({ default: () => null })),
      ],
    })
  )
  const toMatch = matchRoute(manifest, "/photos/7", { baseUrl: "" })!

  it("removes cached prefetch entries for the registration", () => {
    const key = buildInterceptorPrefetchKey(1, toMatch)
    setPrefetchedInterceptorData(key, { cached: true })
    clearInterceptorPrefetchForRegistration(1)
    assert.equal(consumePrefetchedInterceptorData(key).kind, "miss")
  })

  it("keeps cache entries for other registration ids", () => {
    const key1 = buildInterceptorPrefetchKey(1, toMatch)
    const key2 = buildInterceptorPrefetchKey(2, toMatch)
    setPrefetchedInterceptorData(key1, { n: 1 })
    setPrefetchedInterceptorData(key2, { n: 2 })
    clearInterceptorPrefetchForRegistration(1)
    assert.equal(consumePrefetchedInterceptorData(key1).kind, "miss")
    const hit2 = consumePrefetchedInterceptorData(key2)
    assert.equal(hit2.kind, "hit")
    assert.deepEqual(hit2.data, { n: 2 })
  })

  it("does not clear id 10 when clearing id 1 (numeric prefix, not string prefix)", () => {
    const key10 = "10:/photos/[id]:{\"id\":\"7\"}"
    setPrefetchedInterceptorData(key10, { ten: true })
    clearInterceptorPrefetchForRegistration(1)
    assert.equal(consumePrefetchedInterceptorData(key10).kind, "hit")
    clearInterceptorPrefetchForRegistration(10)
    assert.equal(consumePrefetchedInterceptorData(key10).kind, "miss")
  })

  it("aborts in-flight prefetch and prevents cache write after clear", async () => {
    let loadStarted = false
    let cacheWritten = false
    const registration = reg(5)
    registration.load = async ({ signal }) => {
      loadStarted = true
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 50)
        signal.addEventListener("abort", () => {
          clearTimeout(t)
          resolve()
        })
      })
      if (!signal.aborted) {
        cacheWritten = true
        return { late: true }
      }
      throw new Error("aborted")
    }
    const key = buildInterceptorPrefetchKey(5, toMatch)
    const navAbort = new AbortController()
    const prefetchPromise = prefetchInterceptorLoad(
      registration,
      toMatch,
      (m) => ({
        pathname: m.pathname,
        params: m.params,
        search: "",
        hash: "",
      }),
      navAbort.signal
    )
    await new Promise((r) => setTimeout(r, 0))
    assert.equal(loadStarted, true)
    clearInterceptorPrefetchForRegistration(5)
    await prefetchPromise
    assert.equal(cacheWritten, false)
    assert.equal(consumePrefetchedInterceptorData(key).kind, "miss")
  })
})
