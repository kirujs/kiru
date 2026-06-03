import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { createI18nConfig, getI18nLocaleRouting } from "../../router/i18n/index.js"
import {
  prerenderStorageKey,
  resolvePrerenderCacheKey,
} from "../../router/prerenderCacheKey.js"
import {
  createIsrRegenerateHandler,
} from "../../router/prerenderRegenerate.js"
import { memoryPrerenderCache } from "../../router/prerenderCache.js"

describe("prerenderCacheKey", () => {
  it("uses pathname when locale domains are not configured", () => {
    const parsed = new URL("http://localhost/about?q=1")
    const res = resolvePrerenderCacheKey(parsed, {})
    assert.equal(res.cacheKey, "/about")
    assert.equal(res.pathname, "/about")
  })

  it("uses locale::publicPath when domains are configured", () => {
    const i18n = createI18nConfig({
      locales: ["en-US", "fr"],
      defaultLocale: "en-US",
      domains: [
        { domain: "example.com", defaultLocale: "en-US" },
        { domain: "example.fr", defaultLocale: "fr" },
      ],
      load: { "en-US": async () => ({}), fr: async () => ({}) },
    })
    const routing = getI18nLocaleRouting(i18n)
    const en = resolvePrerenderCacheKey(
      new URL("http://example.com/blog"),
      { localeRouting: routing }
    )
    const fr = resolvePrerenderCacheKey(
      new URL("http://example.fr/blog"),
      { localeRouting: routing }
    )
    assert.equal(en.cacheKey, prerenderStorageKey("en-US", "/blog"))
    assert.equal(fr.cacheKey, prerenderStorageKey("fr", "/blog"))
    assert.notEqual(en.cacheKey, fr.cacheKey)
  })

  it("ISR regenerate writes to locale-specific storage key", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [createRoute("/blog", async () => ({ default: () => null }))],
      })
    )
    const store = memoryPrerenderCache()
    const enKey = prerenderStorageKey("en-US", "/blog")
    const frKey = prerenderStorageKey("fr", "/blog")
    await store.set(enKey, {
      html: "en-old",
      pathname: "/blog",
      generatedAt: 0,
      revalidate: 1,
      tags: [],
    })
    await store.set(frKey, {
      html: "fr-old",
      pathname: "/blog",
      generatedAt: 0,
      revalidate: 1,
      tags: [],
    })

    const regen = createIsrRegenerateHandler({
      manifest,
      pathPolicy: { baseUrl: "/", trailingSlash: "never" },
      renderCore: async () => ({
        kind: "string" as const,
        result: { status: 200, headers: {}, body: "en-new" },
      }),
      getPrerenderCache: async () => store,
      bypassPrerenderServe: { current: false },
    })

    await regen(enKey, "/blog")

    assert.equal(store.get(enKey)?.html, "en-new")
    assert.equal(store.get(frKey)?.html, "fr-old")
  })
})
