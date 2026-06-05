import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { withJSDOM } from "./jsdom.js"

const idSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "string") throw new Error("expected string")
    return input
  },
}

describe("resource({ load: query })", () => {
  it("updates when query cache is patched (void query)", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { query } = await import("../../remote/query.js")
      const { applyQueryPatches, buildQueryCacheKey, setQueryCacheEntry } =
        await import("../../remote/queryCache.js")

      const prevMode = renderMode.current
      renderMode.current = "dom"
      try {
        const counterQuery = query(() => ({ count: 0 }))
        counterQuery.__kiruQueryId = "r:test:counter"
        setQueryCacheEntry(buildQueryCacheKey("r:test:counter", null), {
          count: 0,
        })

        const counter = resource({ load: counterQuery })
        await counter.promise
        assert.equal(counter.value!.count, 0)

        applyQueryPatches([
          {
            queryId: "r:test:counter",
            input: null,
            op: "set",
            data: { count: 2 },
          },
        ])
        await counter.promise
        assert.equal(counter.value!.count, 2)
      } finally {
        renderMode.current = prevMode
      }
    })
  })

  it("refetches from cache on patch without calling fetch", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { query } = await import("../../remote/query.js")
      const { applyQueryPatches, buildQueryCacheKey, setQueryCacheEntry } =
        await import("../../remote/queryCache.js")

      const prevMode = renderMode.current
      renderMode.current = "dom"
      let fetchCount = 0
      const prevFetch = globalThis.fetch
      globalThis.fetch = async () => {
        fetchCount += 1
        return new Response(JSON.stringify("unexpected"), { status: 200 })
      }
      try {
        const counterQuery = query(() => ({ count: 0 }))
        counterQuery.__kiruQueryId = "r:test:patch-fetch"
        setQueryCacheEntry(buildQueryCacheKey("r:test:patch-fetch", null), {
          count: 0,
        })

        const counter = resource({ load: counterQuery })
        await counter.promise
        assert.equal(fetchCount, 0)

        applyQueryPatches([
          {
            queryId: "r:test:patch-fetch",
            input: null,
            op: "set",
            data: { count: 3 },
          },
        ])
        await counter.promise
        assert.equal(counter.value?.count, 3)
        assert.equal(fetchCount, 0)
      } finally {
        globalThis.fetch = prevFetch
        renderMode.current = prevMode
      }
    })
  })

  it("refetches when scalar source signal changes", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { signal } = await import("../../signals/base.js")
      const { query } = await import("../../remote/query.js")
      const { buildQueryCacheKey, setQueryCacheEntry } = await import(
        "../../remote/queryCache.js"
      )

      const prevMode = renderMode.current
      renderMode.current = "dom"
      try {
        const getGreeting = query(idSchema, (name: string) => `Hi ${name}`)
        getGreeting.__kiruQueryId = "r:test:greeting"
        setQueryCacheEntry(
          buildQueryCacheKey("r:test:greeting", "Ann"),
          "Hi Ann"
        )
        setQueryCacheEntry(
          buildQueryCacheKey("r:test:greeting", "Bob"),
          "Hi Bob"
        )

        let fetchCount = 0
        const prevFetch = globalThis.fetch
        globalThis.fetch = async () => {
          fetchCount += 1
          return new Response(JSON.stringify("unexpected"), { status: 200 })
        }

        const name = signal("Ann")
        const greeting = resource({ source: name, load: getGreeting })
        await greeting.promise
        assert.equal(greeting.value, "Hi Ann")
        assert.equal(fetchCount, 0)

        name.value = "Bob"
        await greeting.promise
        assert.equal(greeting.value, "Hi Bob")
        assert.equal(fetchCount, 0)

        globalThis.fetch = prevFetch
      } finally {
        renderMode.current = prevMode
      }
    })
  })

  it("updates when query cache is patched (implicit callback load)", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { query } = await import("../../remote/query.js")
      const { applyQueryPatches, buildQueryCacheKey, setQueryCacheEntry } =
        await import("../../remote/queryCache.js")

      const prevMode = renderMode.current
      renderMode.current = "dom"
      try {
        const counterQuery = query(() => ({ count: 0 }))
        counterQuery.__kiruQueryId = "r:test:implicit"
        setQueryCacheEntry(buildQueryCacheKey("r:test:implicit", null), {
          count: 0,
        })

        const counter = resource({ load: counterQuery })
        await counter.promise
        assert.equal(counter.value!.count, 0)

        applyQueryPatches([
          {
            queryId: "r:test:implicit",
            input: null,
            op: "set",
            data: { count: 5 },
          },
        ])
        await counter.promise
        assert.equal(counter.value!.count, 5)
      } finally {
        renderMode.current = prevMode
      }
    })
  })

  it("does not react to unrelated cache patches for a normal async load", async () => {
    await withJSDOM(async () => {
      const { resource } = await import("../../resource.js")
      const { renderMode } = await import("../../globals.js")
      const { signal } = await import("../../signals/base.js")
      const { applyQueryPatches } = await import("../../remote/queryCache.js")

      const prevMode = renderMode.current
      renderMode.current = "dom"
      try {
        const name = signal("x")
        const r = resource({
          source: name,
          load: async (n: string) => n.toUpperCase(),
        })
        await r.promise
        assert.equal(r.value, "X")

        applyQueryPatches([
          {
            queryId: "r:test:unrelated",
            input: null,
            op: "set",
            data: { patched: true },
          },
        ])
        await new Promise<void>((resolve) => queueMicrotask(() => resolve()))
        assert.equal(r.value, "X")
      } finally {
        renderMode.current = prevMode
      }
    })
  })
})
