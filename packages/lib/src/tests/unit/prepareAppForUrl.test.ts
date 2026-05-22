import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  loader,
} from "../../router/index.js"
import { createI18nConfig } from "../../router/i18n/index.js"
import {
  isPrepareError,
  isPrepareRedirect,
  prepareAppForUrl,
} from "../../router/prepareAppForUrl.js"
import { resolvePathPolicy } from "../../router/pathPolicy.js"

const nullComponent = async () => ({ default: () => null })

describe("prepareAppForUrl", () => {
  const pathPolicy = resolvePathPolicy()

  it("returns locale detection redirect with set-cookie", async () => {
    const i18n = createI18nConfig({
      locales: ["en", "fr"],
      defaultLocale: "en",
      localeDetection: true,
      load: {
        en: async () => ({}),
        fr: async () => ({}),
      },
    })
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/", { component: nullComponent }),
          createRoute("/fr", { component: nullComponent }),
        ],
      })
    )
    const request = new Request("http://localhost/", {
      headers: { "accept-language": "fr" },
    })
    const result = await prepareAppForUrl(
      "http://localhost/",
      undefined,
      manifest,
      pathPolicy,
      i18n,
      request
    )
    assert.ok(result && isPrepareRedirect(result))
    assert.match(result.location, /\/fr/)
    assert.ok(result.headers?.["set-cookie"]?.includes("KIRU_LOCALE=fr"))
  })

  it("follows middleware redirect chain and returns redirect to final path", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/a", {
            component: nullComponent,
            middleware: [() => ({ redirect: "/b" })],
          }),
          createRoute("/b", {
            component: nullComponent,
            middleware: [() => ({ redirect: "/c" })],
          }),
          createRoute("/c", {
            component: nullComponent,
          }),
        ],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/a",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && isPrepareRedirect(result))
    assert.equal(result.location, "/c")
  })

  it("returns middleware error response", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [() => ({ error: 403, body: "Forbidden" })],
        children: [
          createRoute("/secret", {
            component: nullComponent,
          }),
        ],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/secret",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && isPrepareError(result))
    assert.equal(result.status, 403)
    assert.equal(result.body, "Forbidden")
  })

  it("merges request context headers into middleware error", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        middleware: [() => ({ error: 503, body: "Unavailable" })],
        children: [createRoute("/x", { component: nullComponent })],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/x",
      { headers: { "x-custom": "1" } },
      manifest,
      pathPolicy
    )
    assert.ok(result && isPrepareError(result))
    assert.equal(result.headers?.["x-custom"], "1")
  })

  it("returns null when middleware aborts", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/abort", {
            component: nullComponent,
            middleware: [() => ({ abort: true })],
          }),
        ],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/abort",
      undefined,
      manifest,
      pathPolicy
    )
    assert.equal(result, null)
  })

  it("redirects to canonical search when query defaults missing", async () => {
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
      load: async ({ query }) => query,
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
    const result = await prepareAppForUrl(
      "http://localhost/search",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && isPrepareRedirect(result))
    assert.equal(result.location, "/search?q=default")
  })

  it("returns 404 PreparedApp for unknown path with notFound route", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        notFound: nullComponent,
        children: [createRoute("/", { component: nullComponent })],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/missing",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && !isPrepareRedirect(result) && !isPrepareError(result))
    assert.equal(result.responseStatus, 404)
    assert.equal(result.routeMatch, null)
    assert.ok(result.app)
  })

  it("returns null for unknown path without notFound route", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [createRoute("/", { component: nullComponent })],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/missing",
      undefined,
      manifest,
      pathPolicy
    )
    assert.equal(result, null)
  })

  it("returns 200 PreparedApp with routeMatch for a matched leaf", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [createRoute("/home", { component: nullComponent })],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/home",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && !isPrepareRedirect(result) && !isPrepareError(result))
    assert.equal(result.responseStatus, 200)
    assert.equal(result.routeMatch?.pathname, "/home")
    assert.ok(result.app)
  })

  it("applies custom page status export", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/created", {
            component: async () => ({
              default: () => null,
              status: 201,
            }),
          }),
        ],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/created",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && !isPrepareRedirect(result) && !isPrepareError(result))
    assert.equal(result.responseStatus, 201)
  })

  it("returns external redirect when middleware lands on a different pathname", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/old", {
            component: nullComponent,
            middleware: [() => ({ redirect: "/new" })],
          }),
          createRoute("/new", { component: nullComponent }),
        ],
      })
    )
    const result = await prepareAppForUrl(
      "http://localhost/old",
      undefined,
      manifest,
      pathPolicy
    )
    assert.ok(result && isPrepareRedirect(result))
    assert.equal(result.location, "/new")
  })
})
