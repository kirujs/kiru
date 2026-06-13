import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createElement } from "../../element.js"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  loader,
} from "../../router/index.js"
import { createRouterApp } from "../../router/bootstrap/csr.js"
import { createI18nConfig } from "../../router/i18n/index.js"
import { getActiveRouter } from "../../router/routerGlobal.js"
import { withJSDOM } from "./jsdom.js"
import { waitForSelector } from "./helpers/hydrationFixtures.js"

describe("CSR error recovery (RouterView)", () => {
  const i18n = createI18nConfig({
    locales: ["en"],
    defaultLocale: "en",
    load: { en: async () => ({}) },
  })

  const routes = createRouteTree({
    layout: async () => ({
      default: ({ children }: { children?: JSX.Children }) =>
        createElement("div", { id: "router-outlet", children }),
    }),
    error: async () => ({
      default: ({ error }: { error: Error }) =>
        createElement(
          "p",
          { "data-testid": "csr-error-page" },
          `CSR error boundary: ${error.message}`
        ),
    }),
    children: [
      createRoute("/", async () => ({
        default: () =>
          createElement("div", { "data-testid": "home-page" }, "home"),
      })),
      createRoute("/about", async () => ({
        default: () =>
          createElement("main", { "data-testid": "csr-about" }, "about"),
      })),
      createRoute("/csr-break", async () => ({
        default: () => {
          throw new Error("e2e-csr-boom")
        },
      })),
      createRoute("/csr-break-loader", {
        component: async () => ({
          default: ({ error }: { error?: Error }) =>
            error
              ? createElement(
                  "p",
                  { "data-testid": "csr-loader-error" },
                  `Loader error: ${error.message}`
                )
              : createElement("p", { "data-testid": "csr-break-loader-page" }, "nope"),
          load: loader(async () => {
            throw new Error("e2e-csr-loader-boom")
          }),
        }),
      }),
    ],
  })

  it("replaces home leaf with about after client navigation", async () => {
    await withJSDOM(async (container) => {
      window.__kiruOutletDebug = true
      window.__kiruOutletDebugLog = []

      const app = await createRouterApp({
        routes: compileRouteTree(routes),
        container,
        i18n,
      })
      const router = getActiveRouter()
      assert.ok(router)
      await waitForSelector(container, '[data-testid="home-page"]', 5000)

      const result = await router.navigate("/about")
      assert.equal(result.status, "committed")
      await waitForSelector(container, '[data-testid="csr-about"]', 5000)
      assert.ok(
        !container.querySelector('[data-testid="home-page"]'),
        "home leaf should be removed after cross-route nav"
      )
      app.unmount()
    })
  })

  it("shows error outlet after navigate to throwing leaf", async () => {
    await withJSDOM(async (container) => {
      const app = await createRouterApp({
        routes: compileRouteTree(routes),
        container,
        i18n,
      })
      const router = getActiveRouter()
      assert.ok(router)
      await router.navigate("/csr-break")
      await waitForSelector(container, '[data-testid="csr-error-page"]', 5000)
      assert.match(
        container.textContent ?? "",
        /CSR error boundary: e2e-csr-boom/
      )
      app.unmount()
    })
  })

  it("passes loader failure via PageProps.error", async () => {
    await withJSDOM(async (container) => {
      const app = await createRouterApp({
        routes: compileRouteTree(routes),
        container,
        i18n,
      })
      const router = getActiveRouter()
      assert.ok(router)
      await router.navigate("/csr-break-loader")
      await waitForSelector(container, '[data-testid="csr-loader-error"]', 5000)
      assert.match(
        container.textContent ?? "",
        /Loader error: e2e-csr-loader-boom/
      )
      app.unmount()
    })
  })
})
