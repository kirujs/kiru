import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { createRouterApp as createCsrRouterApp } from "../../router/bootstrap/csr.js"
import { createRouterApp as createSsrRouterApp } from "../../router/bootstrap/ssr.js"
import { createRouterApp as createSsgRouterApp } from "../../router/bootstrap/ssg.js"
import { withJSDOM } from "./jsdom.js"

describe("router bootstrap entries", () => {
  const routes = createRouteTree({
      children: [
        createRoute("/", async () => ({
          default: () => null,
        })),
      ],
    })
  it("kiru/router/csr createRouterApp returns an AppHandle", async () => {
    await withJSDOM(async (container) => {
      const app = await createCsrRouterApp({ routes, container })
      assert.ok(typeof app.unmount === "function")
    })
  })

  it("kiru/router/ssr createRouterApp is bootstrapSsrClient", () => {
    assert.strictEqual(typeof createSsrRouterApp, "function")
    assert.strictEqual(createSsrRouterApp.name, "createRouterApp")
  })

  it("kiru/router/ssg createRouterApp is bootstrapSsgClient", () => {
    assert.strictEqual(typeof createSsgRouterApp, "function")
    assert.strictEqual(createSsgRouterApp.name, "createRouterApp")
  })
})
