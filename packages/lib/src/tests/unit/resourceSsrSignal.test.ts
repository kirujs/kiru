import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { RemoteQuery } from "../../remote/query.js"
import { withJSDOM } from "./jsdom.js"

describe("resource SSR abort signal", () => {
  it("borrows SSR render signal without creating AbortController", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { query } = await import("../../remote/query.js")
      const { getRequestEvent } = await import("../../remote/remoteRequestEvent.js")
      const { runWithSsrRemoteContext } = await import(
        "../../remote/ssrRemoteScope.js"
      )
      const { buildQueryCacheKey, setQueryCacheEntry } = await import(
        "../../remote/queryCache.js"
      )

      const prevMode = renderMode.current
      renderMode.current = "stream"
      const requestAc = new AbortController()
      let abortControllerCount = 0
      const Orig = globalThis.AbortController
      globalThis.AbortController = class extends Orig {
        constructor() {
          abortControllerCount += 1
          super()
        }
      } as typeof AbortController

      try {
        const counterQuery = query(async () => {
          const { signal } = getRequestEvent()
          assert.equal(signal, requestAc.signal)
          return { ok: true }
        }) as RemoteQuery<void, { ok: boolean }>
        counterQuery.__kiruQueryId = "r:test:ssr-signal"
        setQueryCacheEntry(buildQueryCacheKey("r:test:ssr-signal", null), {
          ok: true,
        })

        const before = abortControllerCount
        runWithSsrRemoteContext({}, requestAc.signal, () => {
          const r = resource({ load: counterQuery })
          void r.promise
        })
        assert.equal(abortControllerCount, before)
      } finally {
        globalThis.AbortController = Orig
        renderMode.current = prevMode
      }
    })
  })
})
