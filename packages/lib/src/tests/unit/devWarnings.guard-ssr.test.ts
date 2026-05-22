import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { runPageLoadFromModule } from "../../router/runPageLoad.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

const loaderCtx = {
  params: {},
  url: { pathname: "/", search: "", hash: "" },
  query: {},
  context: {},
  meta: {},
  route: { id: "route:1" },
  signal: staticLoaderSignal(),
}

const serverMod = {
  load: {
    __kiruLoader: "server" as const,
    __kiruInvoke: async () => ({}),
  },
}

describe("serverLoader on ssr bundle", () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).window = globalThis
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
  })

  it("does not throw without loader RPC (dev warn only)", async () => {
    await assert.doesNotReject(() => runPageLoadFromModule(serverMod, loaderCtx))
  })
})
