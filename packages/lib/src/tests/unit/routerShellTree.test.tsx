import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createElement, Fragment, setup } from "../../index.js"
import { renderMode } from "../../globals.js"
import { headlessRender } from "../../headlessRender.js"
import { mount } from "../../appHandle.js"
import { hydrate } from "../../ssr/client.js"
import { createSsrRouterShell } from "../../router/routerShell.js"
import { createRouter, createStaticRouter } from "../../router/csr.js"
import { buildRoutedSubtree } from "../../router/routeTree.js"
import { defineRouteTree } from "../../router/defineRouteTree.js"
import { compileRouteTree, matchRoute } from "../../router/manifest.js"
import { renderMatchToStaticHtml } from "../../router/renderer.js"
import { withJSDOM } from "./jsdom.js"

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

const routes = defineRouteTree((r) =>
  r.scope({
    layout: async () => ({ default: TestLayout }),
    children: [r.page("/", async () => ({ default: TestPage }))],
  })
)

const manifest = compileRouteTree(routes)

function buildShellSubtree() {
  return buildRoutedSubtree(
    [{ default: TestLayout }],
    { default: TestPage },
    {}
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

function probeIdsFromDom(root: ParentNode): Record<string, string> {
  const probes: Record<string, string> = {}
  root.querySelectorAll("[data-probe]").forEach((el) => {
    const name = el.getAttribute("data-probe")
    const id = el.getAttribute("data-setup-id")
    if (name && id) probes[name] = id
  })
  return probes
}

function staticShell() {
  const router = createStaticRouter({ manifest, pathname: "/" })
  return createSsrRouterShell(router, {}, () => buildShellSubtree())
}

function clientShell() {
  const router = createRouter({ routes })
  return createSsrRouterShell(router, {}, () => buildShellSubtree())
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

function renderShellProbeIds(shell: JSX.Element): Record<string, string> {
  return parseProbeIds(renderShellHtml(shell))
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
  it("setup().id matches across string render, mount, and hydrate", async () => {
    const shell = staticShell()
    const root = wrapRendererRoot(shell)
    const stringIds = renderShellProbeIds(shell)

    await withJSDOM(async (container) => {
      mount(root, container)
      assertSameProbeIds(stringIds, probeIdsFromDom(container), "string vs mount")

      const hydrateContainer = document.createElement("div")
      document.body.appendChild(hydrateContainer)
      hydrateContainer.innerHTML = renderShellHtml(shell)
      hydrate(root, hydrateContainer, { hydrationMode: "dynamic" })
      assertSameProbeIds(
        stringIds,
        probeIdsFromDom(hydrateContainer),
        "string vs hydrate"
      )
      hydrateContainer.remove()
    })
  })

  it("createRouter and createStaticRouter shells share setup().id maps", async () => {
    await withJSDOM(async () => {
      const staticIds = renderShellProbeIds(staticShell())
      const clientIds = renderShellProbeIds(clientShell())
      assertSameProbeIds(staticIds, clientIds, "static vs client router")
    })
  })

  it("createSsrRouterShell matches renderer buildAppElement tree shape", async () => {
    const match = matchRoute(manifest, "/")
    assert.ok(match)
    const { body } = await renderMatchToStaticHtml(manifest, match)
    const rendererIds = parseProbeIds(body)
    const shellIds = renderShellProbeIds(staticShell())
    assertSameProbeIds(
      rendererIds,
      shellIds,
      "renderer vs createSsrRouterShell"
    )
  })
})
