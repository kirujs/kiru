import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  __getSsrRequestContext,
  runWithSsrRequestContext,
} from "../../remote/action.js"
import { getRequestEvent } from "../../remote/remoteRequestEvent.js"
import { query } from "../../remote/query.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import {
  compileRouteTree,
  createRenderer,
  createRoute,
  createRouteTree,
} from "../../router/index.js"
import { __INTERNAL_REMOTE_REGISTRY } from "../../remote/index.js"

const MINIMAL_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"

describe("SSR request context scope", () => {
  it("runWithSsrRequestContext nests scopes via save/restore", () => {
    assert.deepEqual(__getSsrRequestContext(), {})
    runWithSsrRequestContext({ outer: true }, staticLoaderSignal(), () => {
      assert.deepEqual(__getSsrRequestContext(), { outer: true })
      runWithSsrRequestContext({ inner: true }, staticLoaderSignal(), () => {
        assert.deepEqual(__getSsrRequestContext(), { inner: true })
      })
      assert.deepEqual(__getSsrRequestContext(), { outer: true })
    })
    assert.deepEqual(__getSsrRequestContext(), {})
  })

  it("clears SSR action context after renderer.render completes", async () => {
    const routes = createRouteTree({
        children: [
          createRoute("/", async () => ({
            default: () => null,
          })),
        ],
      })
    const renderer = createRenderer({
      routes,
      htmlTemplate: MINIMAL_TPL,
    })
    await renderer.render("/", { context: { user: { name: "Ada" } } })
    assert.deepEqual(__getSsrRequestContext(), {})
  })

  it("query sees request context during synchronous SSR render", async () => {
    const seen: Array<Record<string, unknown>> = []
    const probe = query(async () => {
      const { context } = getRequestEvent()
      seen.push(context as Record<string, unknown>)
      return "ok"
    })
    __INTERNAL_REMOTE_REGISTRY.register("test/ssr-probe", { probe })

    const routes = createRouteTree({
        children: [
          createRoute("/", async () => ({
            default: () => {
              void probe()
              return null
            },
          })),
        ],
      })
    compileRouteTree(routes)
    const renderer = createRenderer({
      routes,
      htmlTemplate: MINIMAL_TPL,
    })
    await renderer.render("/", { context: { role: "admin" } })

    assert.equal(seen.length, 1)
    assert.deepEqual(seen[0], { role: "admin" })
    assert.deepEqual(__getSsrRequestContext(), {})
  })

  it("concurrent sync renders keep separate query contexts", async () => {
    const seen = new Map<string, string>()

    const makeProbe = (label: string) =>
      query(() => {
        const { context } = getRequestEvent()
        seen.set(label, String((context as { id?: string }).id ?? ""))
        return label
      })

    const probeA = makeProbe("a")
    const probeB = makeProbe("b")
    probeA.__kiruQueryId = "test/concurrent:probeA"
    probeB.__kiruQueryId = "test/concurrent:probeB"
    __INTERNAL_REMOTE_REGISTRY.register("test/concurrent", {
      probeA,
      probeB,
    })

    const routes = createRouteTree({
        children: [
          createRoute("/a", async () => ({
            default: () => {
              void probeA()
              return null
            },
          })),
          createRoute("/b", async () => ({
            default: () => {
              void probeB()
              return null
            },
          })),
        ],
      })
    const renderer = createRenderer({
      routes,
      htmlTemplate: MINIMAL_TPL,
    })

    await Promise.all([
      renderer.render("/a", { context: { id: "A" } }),
      renderer.render("/b", { context: { id: "B" } }),
    ])

    assert.equal(seen.get("a"), "A")
    assert.equal(seen.get("b"), "B")
  })
})
