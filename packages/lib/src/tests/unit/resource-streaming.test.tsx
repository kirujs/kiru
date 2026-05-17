import { describe, it } from "node:test"
import assert from "node:assert"
import {
  STREAMED_DATA_DESCENDANTS,
  STREAMED_DATA_EVENT,
} from "../../constants.js"
import { clearStreamedSsrClientState } from "../../router/pageData.js"
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
})
