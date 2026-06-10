import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createElement, Fragment, setup } from "../../index.js"
import { renderMode } from "../../globals.js"
import { headlessRender } from "../../headlessRender.js"
import { createSsrRouterShell } from "../../router/routerShell.js"
import { createRouter, createStaticRouter } from "../../router/csr.js"
import { buildRoutedSubtree } from "../../router/routeTree.js"
import {
  createRoute,
  createRouteTree,
} from "../../router/createRouteTree.js"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import { createI18nConfig } from "../../router/i18n/index.js"
import { createI18nRuntime } from "../../router/i18nContext.js"
import { getRouterInstanceRuntime } from "../../router/routerRuntime.js"
import { SsrClientOutlet } from "../../router/ssrClientOutlet.js"
import { renderMatchToStaticHtml } from "../../router/renderer.js"
import { withJSDOM } from "./jsdom.js"
import { waitForSelector } from "./helpers/hydrationFixtures.js"

function SetupIdProbe({ name }: { name: string }) {
  const $ = setup<{ name: string }>()
  return () =>
    createElement("span", {
      "data-probe": name,
      "data-setup-id": $.id.value,
    })
}

function TestLayout({ children }: { children?: JSX.Children }) {
  const $ = setup<{ children?: JSX.Children }>()
  return () =>
    createElement("div", {
      "data-probe": "layout",
      "data-setup-id": $.id.value,
      children: [createElement(SetupIdProbe, { name: "layout-inner" }), children],
    })
}

function TestPage() {
  return createElement(SetupIdProbe, { name: "leaf" })
}

const routes = createRouteTree({
    layout: async () => ({ default: TestLayout }),
    children: [createRoute("/", async () => ({ default: TestPage }))],
  })
const manifest = compileRouteTree(routes)

function buildShellSubtree(match: ReturnType<typeof matchRoute> = null) {
  return buildRoutedSubtree(
    [{ default: TestLayout }],
    { default: TestPage },
    {},
    { match }
  )
}

function parseProbeIds(html: string): Record<string, string> {
  const probes: Record<string, string> = {}
  const forward =
    /data-probe="([^"]+)"[^>]*data-setup-id="([^"]+)"/g
  const backward =
    /data-setup-id="([^"]+)"[^>]*data-probe="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = forward.exec(html))) {
    probes[m[1]] = m[2]
  }
  while ((m = backward.exec(html))) {
    probes[m[2]] = m[1]
  }
  return probes
}

function wrapStaticOutlet(subtree: JSX.Element) {
  return createElement(SsrClientOutlet, {
    manifest,
    staticSubtree: subtree,
  })
}

function wrapClientOutlet(subtree: JSX.Element) {
  return createElement(SsrClientOutlet, {
    manifest,
    staticSubtree: subtree,
    initialSubtree: subtree,
  })
}

function buildStaticShellElement(): JSX.Element {
  const router = createStaticRouter({ manifest, pathname: "/" })
  const match = matchRoute(manifest, "/")
  const subtree = buildShellSubtree(match)
  return createSsrRouterShell(router, {}, () => wrapStaticOutlet(subtree))
}

function buildClientShell() {
  const router = createRouter({ routes })
  const match = matchRoute(manifest, "/")
  const subtree = buildShellSubtree(match)
  return createSsrRouterShell(router, {}, () => wrapClientOutlet(subtree))
}

function buildStaticShellWithI18n() {
  const router = createStaticRouter({ manifest, pathname: "/" })
  const match = matchRoute(manifest, "/")
  const runtime = createI18nRuntime<unknown>({
    initialLocale: "en",
    initialData: { title: "Home" },
    locales: ["en"],
    defaultLocale: "en",
  })
  const subtree = buildShellSubtree(match)
  return createSsrRouterShell(
    router,
    {},
    () => wrapStaticOutlet(subtree),
    undefined,
    runtime
  )
}

function buildClientShellWithI18n() {
  const i18n = createI18nConfig({
    locales: ["en"],
    defaultLocale: "en",
    load: { en: async () => ({ title: "Home" }) },
  })
  const router = createRouter({ routes, i18n })
  const match = matchRoute(manifest, "/")
  const subtree = buildShellSubtree(match)
  return createSsrRouterShell(
    router,
    {},
    () => wrapClientOutlet(subtree),
    undefined,
    getRouterInstanceRuntime(router).i18n!.runtime
  )
}

/** Same root as {@link renderStringWithDocument} (Fragment + stream headless). */
function wrapRendererRoot(shell: JSX.Element) {
  return Fragment({ children: shell })
}

function renderShellHtml(shell: JSX.Element): string {
  let html = ""
  const prev = renderMode.current
  renderMode.current = "stream"
  try {
    headlessRender(
      {
        write(chunk) {
          html += chunk
        },
      },
      wrapRendererRoot(shell)
    )
  } finally {
    renderMode.current = prev
  }
  return html
}

function renderShellProbeIds(buildShell: () => JSX.Element): Record<string, string> {
  const prev = renderMode.current
  renderMode.current = "stream"
  try {
    return parseProbeIds(renderShellHtml(buildShell()))
  } finally {
    renderMode.current = prev
  }
}

function assertSameProbeIds(
  a: Record<string, string>,
  b: Record<string, string>,
  label: string
) {
  assert.deepEqual(
    a,
    b,
    `${label}: setup().id map should match (${JSON.stringify(a)} vs ${JSON.stringify(b)})`
  )
}

describe("SSR router shell ($INLINE_FN outlet)", () => {
  it("createRouter and createStaticRouter shells share setup().id maps", async () => {
    await withJSDOM(async () => {
      const staticIds = renderShellProbeIds(() => buildStaticShellElement())
      const clientIds = renderShellProbeIds(() => buildClientShell())
      assertSameProbeIds(staticIds, clientIds, "static vs client router")
    })
  })

  it("createSsrRouterShell matches renderer buildAppElement tree shape", async () => {
    const match = matchRoute(manifest, "/")
    assert.ok(match)
    const { body } = await renderMatchToStaticHtml(manifest, match)
    const rendererIds = parseProbeIds(body)
    const shellIds = renderShellProbeIds(() => buildStaticShellElement())
    assertSameProbeIds(
      rendererIds,
      shellIds,
      "renderer vs createSsrRouterShell"
    )
  })

  it("I18nReactiveRoot shell matches between static SSR and client hydrate", async () => {
    await withJSDOM(async () => {
      const staticIds = renderShellProbeIds(() => buildStaticShellWithI18n())
      const clientIds = renderShellProbeIds(() => buildClientShellWithI18n())
      assertSameProbeIds(staticIds, clientIds, "i18n static vs client shell")
    })
  })

  it("cross-route navigation keeps layout setup id when routes share a layout", async () => {
    function AboutPage() {
      return createElement(SetupIdProbe, { name: "about-leaf" })
    }

    const navRoutes = createRouteTree({
      layout: async () => ({ default: TestLayout }),
      children: [
        createRoute("/", async () => ({ default: TestPage })),
        createRoute("/about", async () => ({ default: AboutPage })),
      ],
    })
    const navManifest = compileRouteTree(navRoutes)

    await withJSDOM(
      async (container) => {
        const { mount } = await import("../../appHandle.js")
        const { createRouter } = await import("../../router/csr.js")
        const { createSsrRouterShell } = await import("../../router/routerShell.js")

        const router = createRouter({ routes: navRoutes })
        const app = mount(
          createSsrRouterShell(
            router,
            {},
            createElement(SsrClientOutlet, { manifest: navManifest })
          ),
          container
        )

        await waitForSelector(container, '[data-probe="leaf"]', 5000)
        const layoutIdBefore = container.querySelector(
          '[data-probe="layout"]'
        )?.getAttribute("data-setup-id")
        assert.ok(layoutIdBefore, "layout setup id before nav")

        const result = await router.navigate("/about")
        assert.equal(result.status, "committed")
        await waitForSelector(container, '[data-probe="about-leaf"]', 5000)

        const layoutIdAfter = container.querySelector(
          '[data-probe="layout"]'
        )?.getAttribute("data-setup-id")
        assert.equal(
          layoutIdAfter,
          layoutIdBefore,
          "layout setup id should persist across leaf navigation"
        )

        app.unmount()
      },
      { url: "http://localhost/" }
    )
  })
})
