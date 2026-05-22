import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { createRouterApp as createCsrRouterApp } from "../../router/bootstrap/csr.js"
import { createRouterApp as createSsrRouterApp } from "../../router/bootstrap/ssr.js"
import { createRouterApp as createSsgRouterApp } from "../../router/bootstrap/ssg.js"
import { compileRouteTree } from "../../router/manifest.js"
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

  it("kiru/router/ssr createRouterApp hydrates minimal SSR document", async () => {
    await withJSDOM(
      async (container) => {
        const script = document.createElement("script")
        script.type = "application/json"
        script.setAttribute("k-page-data", "")
        script.textContent = "null"
        document.head.appendChild(script)

        const app = await createSsrRouterApp({
          routes,
          container,
        })
        assert.ok(typeof app.unmount === "function")
        assert.equal(
          typeof (window as typeof window & { __kiruHydratedAt?: number })
            .__kiruHydratedAt,
          "number"
        )
      },
      { url: "http://localhost/" }
    )
  })

  it("kiru/router/ssg createRouterApp hydrates with static hydration mode", async () => {
    await withJSDOM(
      async (container) => {
        const script = document.createElement("script")
        script.type = "application/json"
        script.setAttribute("k-page-data", "")
        script.textContent = "null"
        document.head.appendChild(script)

        const app = await createSsgRouterApp({
          routes,
          container,
        })
        assert.ok(typeof app.unmount === "function")
        assert.equal(
          typeof (window as typeof window & { __kiruHydratedAt?: number })
            .__kiruHydratedAt,
          "number"
        )
      },
      { url: "http://localhost/" }
    )
  })

  it("bootstrapSsrClient accepts precompiled manifest", async () => {
    const { bootstrapSsrClient } = await import("../../ssr/routerHydrate.js")
    const manifest = compileRouteTree(routes)
    await withJSDOM(
      async (container) => {
        const app = await bootstrapSsrClient({
          routes: manifest,
          container,
        })
        assert.ok(typeof app.unmount === "function")
      },
      { url: "http://localhost/" }
    )
  })
})
