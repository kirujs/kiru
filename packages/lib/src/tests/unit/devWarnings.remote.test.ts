import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getRouterBootstrapMode,
  guardRemoteActionOnClient,
  markRouterBootstrap,
} from "../../router/devWarnings.js"

describe("guardRemoteActionOnClient", () => {
  it("throws on csr bootstrap in browser", () => {
    const g = globalThis as Record<string, unknown>
    const prev = g.window
    g.window = {}
    try {
      markRouterBootstrap("csr")
      assert.throws(() => guardRemoteActionOnClient(), /Remote action requires SSR/)
      assert.equal(getRouterBootstrapMode(), "csr")
    } finally {
      g.window = prev
    }
  })

  it("allows ssr bootstrap in browser", () => {
    const g = globalThis as Record<string, unknown>
    const prev = g.window
    g.window = {}
    try {
      markRouterBootstrap("ssr")
      assert.doesNotThrow(() => guardRemoteActionOnClient())
    } finally {
      g.window = prev
    }
  })
})
