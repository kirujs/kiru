import { describe, it } from "node:test"
import assert from "node:assert"
import {
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
} from "../../constants.js"
import {
  parseKDataScriptsFromDocument,
  resetClientKDataStore,
  seedQueryCacheFromKDataStore,
  serializeKDataScript,
} from "../../router/dataRefs.js"
import {
  buildQueryCacheKey,
  buildQueryWireRefId,
  clearAllQueryCache,
  getQueryCacheEntryForKey,
} from "../../remote/queryCache.js"
import {
  clearStreamedSsrClientState,
  readHydratedPageData,
  replayInitialStreamedResources,
  resetHydratedPageData,
  setBuildingInitialSsrOutlet,
} from "../../router/pageData.js"
import { renderMode } from "../../globals.js"
import { withJSDOM } from "./jsdom.js"

const waitForMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("resource streamed SSR client hydration", () => {
  it("resolves via announced descendant id when local id differs", async () => {
    await withJSDOM(async (container, kiru) => {
      const cache = new window.Map<string, { data?: unknown; error?: string }>()
      const announced = new window.Set<string>()
      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        cache
      ;(window as unknown as Record<string, unknown>)[
        STREAMED_DATA_DESCENDANTS
      ] = announced

      const serverId = "k:0.1.2:resource:0"
      announced.add(serverId)
      cache.set(serverId, { data: ["from server"] })

      let loaderCalls = 0
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(() => {
          loaderCalls++
          return Promise.resolve(["client fetch"])
        })
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? ""}</span>
        )
      }

      const prev = renderMode.current
      renderMode.current = "dom"
      kiru.mount(<ReviewsCard />, container)
      await reviews.promise
      for (let i = 0; i < 5; i++) await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0)
      assert.strictEqual(reviews.value?.[0], "from server")
      renderMode.current = prev
    })
  })

  it("uses deferred resolution in dom mode when stream cache is primed", async () => {
    await withJSDOM(async (container, kiru) => {
      const cache = new window.Map<string, { data?: unknown; error?: string }>()
      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        cache

      let loaderCalls = 0
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(() => {
          loaderCalls++
          return Promise.resolve(["client fetch"])
        })
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? ""}</span>
        )
      }

      const prev = renderMode.current
      renderMode.current = "dom"

      kiru.mount(<ReviewsCard />, container)
      await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0, "should wait on stream, not fetch")
      assert.ok(
        reviews.promise.id.startsWith("k:"),
        "streamed SSR client should use deterministic resource ids"
      )

      const payload = ["Review for p1"]
      cache.set(reviews.promise.id, { data: payload })
      window.dispatchEvent(
        new window.CustomEvent(STREAMED_DATA_EVENT, {
          detail: { id: reviews.promise.id, data: payload },
        })
      )

      await reviews.promise
      for (let i = 0; i < 5; i++) await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0)
      assert.strictEqual(reviews.value?.[0], "Review for p1")
      assert.strictEqual(
        container.querySelector('[data-testid="reviews"]')?.textContent,
        "Review for p1"
      )

      renderMode.current = prev
    })
  })

  it("resolves streamed nested $$ref payloads against k-data store", async () => {
    await withJSDOM(async (container, kiru) => {
      const cache = new window.Map<
        string,
        { data?: unknown; error?: string }
      >()
      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        cache

      const queryId = "r:test:reviews"
      const wireRefId = buildQueryWireRefId(buildQueryCacheKey(queryId, null))
      const payload = ["from k-data"]
      document.head.innerHTML = serializeKDataScript(wireRefId, { data: payload })
      parseKDataScriptsFromDocument()

      let loaderCalls = 0
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(() => {
          loaderCalls++
          return Promise.resolve(["client fetch"])
        })
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? ""}</span>
        )
      }

      const prev = renderMode.current
      renderMode.current = "dom"
      kiru.mount(<ReviewsCard />, container)
      await waitForMicrotask()

      cache.set(reviews.promise.id, {
        data: { $$ref: wireRefId },
      })
      window.dispatchEvent(
        new window.CustomEvent(STREAMED_DATA_EVENT, {
          detail: { id: reviews.promise.id, data: { $$ref: wireRefId } },
        })
      )

      await reviews.promise
      for (let i = 0; i < 5; i++) await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0)
      assert.strictEqual(reviews.value?.[0], "from k-data")
      renderMode.current = prev
    })
  })

  it("seeds hydrate cache for resource input with optional undefined field", async () => {
    await withJSDOM(async () => {
      clearStreamedSsrClientState()
      resetHydratedPageData()
      clearAllQueryCache()
      resetClientKDataStore()

      const queryId = "r:test:feed"
      const payload = [{ id: "p1", sort: "hot" }]
      const wireRefId = buildQueryWireRefId(
        buildQueryCacheKey(queryId, { sort: "hot" })
      )
      document.head.innerHTML =
        serializeKDataScript(wireRefId, { data: payload }) +
        `<script type="application/json" k-page-data>${JSON.stringify({
          posts: { $$ref: wireRefId },
        })}</script>`

      readHydratedPageData()

      const resourceCacheKey = buildQueryCacheKey(queryId, {
        sort: "hot",
        communitySlug: undefined,
      })
      assert.deepEqual(
        getQueryCacheEntryForKey(resourceCacheKey)?.data,
        payload,
        "hydrate cache should resolve resource-shaped keys via wire ref"
      )

      clearAllQueryCache()
      resetClientKDataStore()
      resetHydratedPageData()
    })
  })

  it("fetches after streamed SSR state is cleared (client navigation)", async () => {
    await withJSDOM(async (container, kiru) => {
      const cache = new window.Map<string, { data?: unknown; error?: string }>()
      const announced = new window.Set<string>()
      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        cache
      ;(window as unknown as Record<string, unknown>)[
        STREAMED_DATA_DESCENDANTS
      ] = announced

      const staleId = "k:0.1.2:resource:0"
      announced.add(staleId)
      cache.set(staleId, { data: ["stale"] })

      let loaderCalls = 0
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(() => {
          loaderCalls++
          return Promise.resolve(["fresh"])
        })
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? ""}</span>
        )
      }

      clearStreamedSsrClientState()

      const prev = renderMode.current
      renderMode.current = "dom"
      kiru.mount(<ReviewsCard />, container)
      await reviews.promise
      for (let i = 0; i < 5; i++) await waitForMicrotask()

      assert.strictEqual(loaderCalls, 1)
      assert.strictEqual(reviews.value?.[0], "fresh")
      renderMode.current = prev
    })
  })

  it("defers sync cache consume during scratch outlet build and replays after", async () => {
    await withJSDOM(async (container, kiru) => {
      clearStreamedSsrClientState()

      const cache = new window.Map<string, { data?: unknown; error?: string }>()
      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        cache

      let loaderCalls = 0
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(() => {
          loaderCalls++
          return Promise.resolve(["client fetch"])
        })
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? ""}</span>
        )
      }

      const prev = renderMode.current
      renderMode.current = "dom"
      setBuildingInitialSsrOutlet(true)

      kiru.mount(<ReviewsCard />, container)
      await waitForMicrotask()

      const streamId = reviews.promise.id
      const payload = ["from deferred replay"]
      cache.set(streamId, { data: payload })

      assert.strictEqual(
        loaderCalls,
        0,
        "scratch defer should not fetch while cache entry remains"
      )
      assert.strictEqual(
        cache.has(streamId),
        true,
        "cache entry should survive deferred consume"
      )

      setBuildingInitialSsrOutlet(false)
      replayInitialStreamedResources()

      await reviews.promise
      for (let i = 0; i < 5; i++) await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0)
      assert.strictEqual(reviews.value?.[0], "from deferred replay")
      renderMode.current = prev
    })
  })

  it("does not mark resource rejected when load is aborted", async () => {
    await withJSDOM(async (container, kiru) => {
      let reviews!: ReturnType<typeof kiru.resource<string[]>>

      function ReviewsCard() {
        reviews = kiru.resource(({ signal }) =>
          new Promise<string[]>((resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"))
            })
            setTimeout(() => resolve(["late"]), 500)
          })
        )
        return () => (
          <span data-testid="reviews">{reviews.value?.[0] ?? "pending"}</span>
        )
      }

      const prev = renderMode.current
      renderMode.current = "dom"
      const app = kiru.mount(<ReviewsCard />, container)
      await waitForMicrotask()

      app.unmount()
      await waitForMicrotask()

      assert.notEqual(reviews.promise.state, "rejected")
      renderMode.current = prev
    })
  })

  it("defers query cache short-circuit during scratch outlet build", async () => {
    await withJSDOM(async (container, kiru) => {
      clearAllQueryCache()
      resetClientKDataStore()

      const queryId = "r:test:communities"
      const payload = [{ id: "c1", slug: "kiru" }]
      const wireRefId = buildQueryWireRefId(buildQueryCacheKey(queryId, null))
      document.head.innerHTML = serializeKDataScript(wireRefId, { data: payload })
      seedQueryCacheFromKDataStore(parseKDataScriptsFromDocument())

      const listCommunities = Object.assign(
        async () => {
          loaderCalls++
          return payload
        },
        { __kiruQueryId: queryId, __kiruRemoteQuery: true as const, __kiruQueryVoid: true }
      )

      let loaderCalls = 0
      let communities!: ReturnType<typeof kiru.resource<typeof payload>>

      function Sidebar() {
        communities = kiru.resource({
          load: listCommunities as typeof listCommunities & { __kiruQueryId: string },
          defaultState: [] as typeof payload,
        })
        return () => (
          <span data-testid="count">{communities.value?.length ?? 0}</span>
        )
      }

      ;(window as unknown as Record<string, unknown>)[STREAMED_DATA_EVENT] =
        new window.Map()

      const prev = renderMode.current
      renderMode.current = "dom"
      setBuildingInitialSsrOutlet(true)

      kiru.mount(<Sidebar />, container)
      await waitForMicrotask()

      assert.strictEqual(loaderCalls, 0)
      assert.strictEqual(communities.promise.state, "pending")
      assert.strictEqual(
        container.querySelector('[data-testid="count"]')?.textContent,
        "0"
      )

      setBuildingInitialSsrOutlet(false)
      communities.refetch()
      await communities.promise
      await waitForMicrotask()

      assert.deepEqual(
        getQueryCacheEntryForKey(buildQueryCacheKey(queryId, null))?.data,
        payload
      )
      assert.strictEqual(communities.value?.[0]?.slug, "kiru")
      renderMode.current = prev
    })
  })
})
