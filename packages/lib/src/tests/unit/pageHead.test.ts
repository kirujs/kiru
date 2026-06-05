import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import {
  createDynamicHeadContext,
  defineHeadContent,
  invokePageHeadResolve,
  isDynamicPageHead,
  isStaticPageHead,
  pageHeadResolveIsAsync,
  resolvePageHead,
} from "../../router/pageHead.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"

function headCtx() {
  const loaderCtx = buildLoaderContext({
    params: { id: "7" },
    pathname: "/items/7",
    search: "",
    hash: "",
    query: {},
    context: {},
    routeId: "items",
    signal: staticLoaderSignal(),
  })
  return createDynamicHeadContext(loaderCtx, {})
}

describe("defineHeadContent", () => {
  it("tags sync functions as dynamic", () => {
    const head = defineHeadContent((ctx) => ({
      title: `Item ${ctx.params.id}`,
    }))
    assert.equal(head.__kiruPageHead, "dynamic")
    assert.equal(isDynamicPageHead(head), true)
    assert.equal(isStaticPageHead(head), false)
  })

  it("tags async functions as dynamic", () => {
    const head = defineHeadContent(async () => ({ title: "Async" }))
    assert.equal(head.__kiruPageHead, "dynamic")
    assert.equal(isDynamicPageHead(head), true)
  })

  it("tags static objects as static", () => {
    const head = defineHeadContent({ title: "Static" })
    assert.equal(head.__kiruPageHead, "static")
    assert.equal(isStaticPageHead(head), true)
  })
})

describe("invokePageHeadResolve", () => {
  it("returns sync for param-only dynamic head", () => {
    const head = defineHeadContent((ctx) => ({
      title: `Item ${ctx.params.id}`,
    }))
    const ctx = headCtx()
    const invoked = invokePageHeadResolve(head, ctx)
    assert.equal(invoked.kind, "sync")
    if (invoked.kind === "sync") {
      assert.equal(invoked.value.title, "Item 7")
    }
    assert.equal(pageHeadResolveIsAsync(head, ctx), false)
  })

  it("returns async for async function head", async () => {
    const head = defineHeadContent(async () => ({ title: "Async" }))
    const ctx = headCtx()
    const invoked = invokePageHeadResolve(head, ctx)
    assert.equal(invoked.kind, "async")
    assert.equal(pageHeadResolveIsAsync(head, ctx), true)
    if (invoked.kind === "async") {
      assert.equal((await invoked.promise).title, "Async")
    }
  })

  it("returns async when sync function returns a Promise", async () => {
    const head = defineHeadContent((ctx) =>
      ctx.loader().then(() => ({ title: "From loader" }))
    )
    const ctx = headCtx()
    const invoked = invokePageHeadResolve(head, ctx)
    assert.equal(invoked.kind, "async")
    assert.equal(pageHeadResolveIsAsync(head, ctx), true)
  })
})

describe("resolvePageHead", () => {
  it("awaits promise-returning dynamic head", async () => {
    const head = defineHeadContent(async () => ({ title: "Resolved" }))
    const meta = await resolvePageHead(head, headCtx())
    assert.equal(meta.title, "Resolved")
  })
})
