import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createElement } from "../../element.js"
import { createRouter } from "../../router/csr.js"
import {
  createRoute,
  createRouteTree,
} from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { createI18nConfig } from "../../router/i18n/index.js"
import { useI18n } from "../../router/i18nContext.js"
import { buildInitialSsrOutletInShell } from "../../router/ssrClientOutlet.js"
import { bootstrapSsgClient } from "../../ssr/routerHydrate.js"
import { withJSDOM } from "./jsdom.js"

describe("SsrClientOutlet", () => {
  it("buildInitialSsrOutletInShell returns a route subtree for static hydration", async () => {
    const routes = createRouteTree({
      children: [
        createRoute("/about", async () => ({
          default: () =>
            createElement("main", {
              "data-testid": "about",
              children: "ok",
            }),
        })),
      ],
    })

    await withJSDOM(
      async () => {
        const router = createRouter({ routes })
        const manifest = compileRouteTree(routes)
        const subtree = await buildInitialSsrOutletInShell(router, manifest, {})
        assert.ok(subtree)
      },
      { url: "http://localhost/about" }
    )
  })

  it("bootstrapSsgClient does not surface useI18n provider error on direct /about load", async () => {
    let setupSawI18n = false
    const routes = createRouteTree({
      children: [
        createRoute("/about", async () => ({
          default: function About() {
            useI18n()
            setupSawI18n = true
            return () =>
              createElement("main", {
                "data-testid": "about",
                children: "ok",
              })
          },
        })),
      ],
    })
    const i18n = createI18nConfig({
      locales: ["en"],
      defaultLocale: "en",
      load: { en: async () => ({ title: "About" }) },
    })

    await withJSDOM(
      async (container) => {
        const pageData = document.createElement("script")
        pageData.type = "application/json"
        pageData.setAttribute("k-page-data", "")
        pageData.textContent = "null"
        document.head.appendChild(pageData)

        const i18nScript = document.createElement("script")
        i18nScript.type = "application/json"
        i18nScript.setAttribute("k-i18n", "")
        i18nScript.textContent = JSON.stringify({
          locale: "en",
          data: { title: "About" },
        })
        document.head.appendChild(i18nScript)

        container.innerHTML = '<main data-testid="about">ok</main>'

        const app = await bootstrapSsgClient({ routes, container, i18n })
        assert.equal(setupSawI18n, true, "route setup should run under I18nReactiveRoot on hydrate")
        const text = container.textContent ?? ""
        assert.doesNotMatch(text, /useI18n\(\) requires I18nProvider/)
        assert.doesNotMatch(text, /SSG error boundary/)
        app.unmount()
      },
      { url: "http://localhost/about" }
    )
  })
})
