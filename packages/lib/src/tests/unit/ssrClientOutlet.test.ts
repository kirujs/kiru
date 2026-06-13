import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mount } from "../../appHandle.js"
import { createElement } from "../../element.js"
import { createRouter } from "../../router/csr.js"
import {
  createRoute,
  createRouteTree,
} from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { createI18nConfig } from "../../router/i18n/index.js"
import { useI18n } from "../../router/i18nContext.js"
import { createSsrRouterShell } from "../../router/routerShell.js"
import {
  buildInitialSsrOutletInShell,
  SsrClientOutlet,
} from "../../router/ssrClientOutlet.js"
import { readOutletDebugLog } from "../../router/outletDebug.js"
import { bootstrapSsgClient } from "../../ssr/routerHydrate.js"
import { withJSDOM } from "./jsdom.js"
import { waitForSelector } from "./helpers/hydrationFixtures.js"
import { createElement as el, setup } from "../../index.js"

function SetupIdProbe({ name }: { name: string }) {
  const $ = setup<{ name: string }>()
  return () =>
    el("span", {
      "data-probe": name,
      "data-testid": name,
      "data-setup-id": $.id.value,
    })
}

function SharedLayout({ children }: { children?: JSX.Children }) {
  return () =>
    el("div", {
      "data-testid": "layout",
      "data-probe": "layout",
      children,
    })
}

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

  it("cross-route navigation does not abort-discard outlet load or bump loaderEpoch", async () => {
    const routes = createRouteTree({
      children: [
        createRoute("/", async () => ({
          default: () =>
            createElement("div", {
              "data-testid": "home",
              children: "home",
            }),
        })),
        createRoute("/about", async () => ({
          default: () =>
            createElement("div", {
              "data-testid": "about",
              children: "about",
            }),
        })),
      ],
    })
    const manifest = compileRouteTree(routes)

    await withJSDOM(
      async (container) => {
        window.__kiruOutletDebug = true
        window.__kiruOutletDebugLog = []

        const router = createRouter({ routes })
        const app = mount(
          createSsrRouterShell(
            router,
            {},
            createElement(SsrClientOutlet, { manifest })
          ),
          container
        )

        await waitForSelector(container, '[data-testid="home"]', 5000)
        const epochBefore = router.loaderEpoch.peek()
        window.__kiruOutletDebugLog = []

        const result = await router.navigate("/about")
        assert.equal(result.status, "committed")
        await waitForSelector(container, '[data-testid="about"]', 5000)

        assert.equal(
          router.loaderEpoch.peek(),
          epochBefore,
          "route change should not bump loaderEpoch"
        )

        const abortedDiscards = readOutletDebugLog().filter(
          (entry) =>
            entry.event === "outlet:load:discarded" &&
            entry.data?.reason === "aborted"
        )
        assert.equal(
          abortedDiscards.length,
          0,
          `unexpected abort discards: ${JSON.stringify(abortedDiscards)}`
        )

        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })

  it("cross-route navigation commits new leaf content and removes the previous leaf", async () => {
    function HomePage() {
      return el(SetupIdProbe, { name: "home" })
    }

    function AboutPage() {
      return el(SetupIdProbe, { name: "about" })
    }

    const routes = createRouteTree({
      layout: async () => ({ default: SharedLayout }),
      children: [
        createRoute("/", async () => ({ default: HomePage })),
        createRoute("/about", async () => ({ default: AboutPage })),
      ],
    })
    const manifest = compileRouteTree(routes)

    await withJSDOM(
      async (container) => {
        const router = createRouter({ routes })
        const app = mount(
          createSsrRouterShell(
            router,
            {},
            createElement(SsrClientOutlet, { manifest })
          ),
          container
        )

        await waitForSelector(container, '[data-testid="home"]', 5000)
        assert.ok(
          !container.querySelector('[data-testid="about"]'),
          "about leaf should not be mounted on home"
        )

        const toAbout = await router.navigate("/about")
        assert.equal(toAbout.status, "committed")
        assert.equal(router.pathname.peek(), "/about")
        await waitForSelector(container, '[data-testid="about"]', 5000)

        const toHome = await router.navigate("/")
        assert.equal(toHome.status, "committed")
        assert.equal(router.pathname.peek(), "/")
        await waitForSelector(container, '[data-testid="home"]', 5000)

        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })

  it("records outlet debug timeline for successful / → /about navigation", async () => {
    const routes = createRouteTree({
      children: [
        createRoute("/", async () => ({
          default: () =>
            createElement("div", {
              "data-testid": "home",
              children: "home",
            }),
        })),
        createRoute("/about", async () => ({
          default: () =>
            createElement("div", {
              "data-testid": "about",
              children: "about",
            }),
        })),
      ],
    })
    const manifest = compileRouteTree(routes)

    await withJSDOM(
      async (container) => {
        window.__kiruOutletDebug = true
        window.__kiruOutletDebugLog = []

        const router = createRouter({ routes })
        const app = mount(
          createSsrRouterShell(
            router,
            {},
            createElement(SsrClientOutlet, { manifest })
          ),
          container
        )

        await waitForSelector(container, '[data-testid="home"]', 5000)
        window.__kiruOutletDebugLog = []

        const result = await router.navigate("/about")
        assert.equal(result.status, "committed")
        await waitForSelector(container, '[data-testid="about"]', 5000)

        const events = readOutletDebugLog().map((e) => e.event)
        const loadStarts = events.filter((e) => e === "outlet:load:start")
        const loadCompletes = readOutletDebugLog().filter(
          (e) => e.event === "outlet:load:complete"
        )

        assert.ok(
          loadStarts.length >= 1,
          `expected outlet:load:start, got ${JSON.stringify(events)}`
        )
        assert.ok(
          loadCompletes.some((e) => e.data?.subtree === "ok"),
          `expected outlet:load:complete subtree ok, got ${JSON.stringify(loadCompletes)}`
        )
        assert.ok(
          events.includes("leaf:built"),
          `expected leaf:built, got ${JSON.stringify(events)}`
        )
        assert.ok(
          container.querySelector('[data-testid="about"]'),
          "about DOM should be visible after navigation"
        )

        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })
})
