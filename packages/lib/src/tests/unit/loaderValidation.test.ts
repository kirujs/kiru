import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loader,
  readPageLoadExport,
} from "../../router/loaders.js"
import {
  canonicalQueryDiffersFromUrl,
  serializeValidatedQuery,
} from "../../router/searchParams.js"
import {
  normalizeLoaderValidation,
  validateParamsFromRecord,
  validateRouteInput,
} from "../../router/loaderValidation.js"
import { validateSearchForMatch } from "../../router/validateSearchForMatch.js"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  matchRoute,
} from "../../router/index.js"

describe("loader validation", () => {
  it("stores validation on KiruLoader from loader config", () => {
    const querySchema = {
      parse(input: unknown) {
        if (typeof input !== "object" || input === null || !("q" in input)) {
          throw new Error("bad")
        }
        return input as { q: string }
      },
    }
    const load = loader({
      validation: { query: querySchema, onInvalid: (c) => c.notFound() },
      load: async ({ query }) => query,
    })
    assert.ok(load.__kiruValidation?.query)
    assert.equal(load.__kiruValidation?.params, undefined)
  })

  it("validateRouteInput parses query and params", async () => {
    const validation = normalizeLoaderValidation({
      query: {
        parse(input: unknown) {
          if (typeof input !== "object" || input === null || !("q" in input)) {
            throw new Error("bad")
          }
          return input as { q: string }
        },
      },
      params: {
        parse(input: unknown) {
          if (typeof input !== "object" || input === null || !("id" in input)) {
            throw new Error("bad")
          }
          const id = (input as { id: string }).id
          if (!/^\d+$/.test(id)) throw new Error("bad id")
          return { id: Number(id) }
        },
      },
    })
    const ok = await validateRouteInput(validation, { q: ["hi"] }, { id: "42" })
    assert.ok(ok.ok)
    if (!ok.ok) return
    assert.deepEqual(ok.value.validatedQuery, { q: "hi" })
    assert.deepEqual(ok.value.params, { id: 42 })
  })

  it("validateParamsFromRecord returns notFound on failure", async () => {
    const validation = normalizeLoaderValidation({
      params: {
        parse() {
          throw new Error("nope")
        },
      },
      onInvalid: (c) => c.notFound(),
    })
    const r = await validateParamsFromRecord(validation.params!, { id: "1" })
    assert.equal(r.ok, false)
  })

  it("redirectToCanonical returns redirect when URL lacks defaulted keys", async () => {
    const validation = normalizeLoaderValidation({
      query: {
        parse(input: unknown) {
          if (typeof input !== "object" || input === null || !("q" in input)) {
            throw new Error("bad")
          }
          return input as { q: string }
        },
      },
      queryDefaults: { q: "default" },
      redirectToCanonical: true,
    })
    const result = await validateRouteInput(
      validation,
      {},
      {},
      { pathname: "/search-schema" }
    )
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.failure.kind, "redirect")
    if (result.failure.kind === "redirect") {
      assert.equal(result.failure.location, "/search-schema?q=default")
    }
  })

  it("serializeValidatedQuery and canonical diff", () => {
    assert.equal(serializeValidatedQuery({ q: "a", page: 2 }), "page=2&q=a")
    assert.equal(
      canonicalQueryDiffersFromUrl({ q: ["ok"] }, { q: "ok" }),
      false
    )
    assert.equal(
      canonicalQueryDiffersFromUrl({}, { q: "default" }),
      true
    )
  })

  it("validateSearchForMatch reads validation from load export", async () => {
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
      load: async ({ query }) => query,
    })
    const routes = createRouteTree({
        children: [
          createRoute("/search", {
            component: async () => ({
              default: () => null,
              load: pageLoad,
            }),
          }),
        ],
      })
    const manifest = compileRouteTree(routes)
    const match = matchRoute(manifest, "/search")!
    const check = await validateSearchForMatch(match, { q: ["ok"] })
    assert.ok(check.ok)
    if (!check.ok) return
    assert.deepEqual(check.validatedQuery, { q: "ok" })
  })
})

describe("readPageLoadExport", () => {
  it("returns loader with validation metadata", () => {
    const mod = {
      load: loader({
        validation: {
          query: {
            parse: (input: unknown) => input as { q: string },
          },
        },
        load: async () => ({}),
      }),
    }
    const load = readPageLoadExport(mod)
    assert.ok(load?.__kiruValidation?.query)
  })
})
