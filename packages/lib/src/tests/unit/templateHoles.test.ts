import { describe, it } from "node:test"
import assert from "node:assert"
import { createElement, Fragment } from "../../element.js"
import { headlessRender } from "../../headlessRender.js"
import { _template, createHoledTemplate } from "../../template.js"
import { KIRU_HOLE_MARKER } from "../../utils/staticHtml.js"
import { renderToString } from "../../renderToString.js"
import { hydrate } from "../../ssr/client.js"
import { Link } from "../../router/link.js"
import { RouterProvider } from "../../router/routerContext.js"
import { createStaticRouter } from "../../router/csr.js"
import { createRoute, createRouteTree } from "../../router/createRouteTree.js"
import { compileRouteTree } from "../../router/manifest.js"
import { withJSDOM } from "./jsdom.js"

const linkManifest = compileRouteTree(
  createRouteTree({
    children: [createRoute("/", async () => ({ default: () => null }))],
  })
)

describe("template holes", () => {
  it("headlessRender writes hole markers when there are no hole children", () => {
    const html = `<div><span>A</span>${KIRU_HOLE_MARKER}</div>`
    const tpl = _template(html, 1)()
    let out = ""
    headlessRender({ write: (chunk) => (out += chunk) }, tpl)
    assert.strictEqual(out, html)
  })

  it("headlessRender inlines hole children at markers", () => {
    const html = `<div><span>A</span>${KIRU_HOLE_MARKER}</div>`
    const dynamic = createElement("span", { className: "dyn", children: "live" })
    const tpl = createHoledTemplate(_template(html, 1), [dynamic])
    let out = ""
    headlessRender({ write: (chunk) => (out += chunk) }, tpl)
    assert.ok(out.includes("<span>A</span>"))
    assert.ok(out.includes('class="dyn"'))
    assert.ok(out.includes("live"))
    assert.ok(out.includes(KIRU_HOLE_MARKER))
  })

  it("mounts dynamic child at hole", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><span>Static</span>${KIRU_HOLE_MARKER}</div>`
      const factory = _template(html, 1)
      const dynamic = createElement("span", { className: "dyn", children: "live" })
      kiru.mount(createHoledTemplate(factory, [dynamic]), container)
      assert.strictEqual(
        container.querySelector(".dyn")?.textContent,
        "live"
      )
      assert.strictEqual(
        container.querySelector("span:not(.dyn)")?.textContent,
        "Static"
      )
      // hole comment anchor remains for updates
      assert.ok(
        [...container.querySelector("div")!.childNodes].some(
          (n) => n.nodeType === Node.COMMENT_NODE
        )
      )
    })
  })

  it("headlessRender resolves router context for Link children in template holes", () => {
    const router = createStaticRouter({ manifest: linkManifest, pathname: "/" })
    const Nav = () =>
      createHoledTemplate(_template(`<nav>${KIRU_HOLE_MARKER}</nav>`, 1), [
        createElement(Link, { to: "/", children: "Home" }),
      ])
    const app = createElement(RouterProvider, {
      router,
      children: createElement(Nav),
    })
    let out = ""
    headlessRender(
      { write: (chunk) => (out += chunk) },
      Fragment({ children: app })
    )
    assert.ok(out.includes("Home"))
    assert.ok(out.includes('href="/"'))
  })

  it("headlessRender inlines array region at a single hole", () => {
    const html = `<nav>${KIRU_HOLE_MARKER}</nav>`
    const a = createElement("a", { href: "/", children: "Home" })
    const b = createElement("a", { href: "/about", children: "About" })
    const tpl = createHoledTemplate(_template(html, 1), [[a, b]])
    let out = ""
    headlessRender({ write: (chunk) => (out += chunk) }, tpl)
    assert.ok(out.includes('href="/"'))
    assert.ok(out.includes('href="/about"'))
  })

  it("mounts host + component children across separate holes", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div>${KIRU_HOLE_MARKER}${KIRU_HOLE_MARKER}</div>`
      const factory = _template(html, 2)
      const input = createElement("input", { type: "number", "data-testid": "hole-input" })
      const Counter = () =>
        createElement("section", {
          "data-testid": "hole-counter",
          children: "counter",
        })

      kiru.mount(
        createHoledTemplate(factory, [input, createElement(Counter, {})]),
        container
      )

      assert.ok(container.querySelector('[data-testid="hole-input"]'))
      const section = container.querySelector("section")
      const rootNode = (container.querySelector("div") as Element & {
        __kiruNode?: Kiru.VNode
      }).__kiruNode
      assert.ok(rootNode?.child, "expected template vnode child")
      assert.ok(rootNode?.child?.sibling, "expected second hole sibling vnode")
      assert.ok(section, container.innerHTML)
      assert.strictEqual(section.textContent, "counter")

      const assertHoleChainHealthy = (head: Kiru.VNode | null | undefined) => {
        const seen = new Set<Kiru.VNode>()
        let node = head ?? null
        while (node) {
          assert.notStrictEqual(
            node.sibling,
            node,
            "vnode must not be its own sibling"
          )
          assert.ok(!seen.has(node), "hole weave must not form a cycle")
          seen.add(node)
          node = node.sibling
        }
        assert.strictEqual(seen.size, 2, "expected both hole heads in weave chain")
      }
      assertHoleChainHealthy(rootNode.child)

      const CounterUpdated = () =>
        createElement("section", {
          "data-testid": "hole-counter",
          children: "updated",
        })
      const app = container.__kiruNode!.app!
      app.render(
        createHoledTemplate(factory, [
          input,
          createElement(CounterUpdated, {}),
        ])
      )
      assert.strictEqual(
        container.querySelector('[data-testid="hole-counter"]')?.textContent,
        "updated"
      )
      assertHoleChainHealthy(rootNode.child)
    })
  })

  it("hydrates holed template from SSR html", async () => {
    await withJSDOM(async (container) => {
      const html = `<div><span>Static</span>${KIRU_HOLE_MARKER}</div>`
      const dynamic = createElement("span", { className: "dyn", children: "live" })
      const tpl = createHoledTemplate(_template(html, 1), [dynamic])
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, tpl)
      container.innerHTML = ssr
      hydrate(tpl, container)
      assert.strictEqual(
        container.querySelector(".dyn")?.textContent,
        "live"
      )
      assert.strictEqual(
        container.querySelector("span:not(.dyn)")?.textContent,
        "Static"
      )
    })
  })

  it("removes prior outlet DOM when a template hole child is replaced", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div>${KIRU_HOLE_MARKER}</div>`
      const factory = _template(html, 1)
      const Home = () =>
        createElement("p", { "data-testid": "page", children: "home" })
      const About = () =>
        createElement("p", { "data-testid": "page", children: "about" })

      kiru.mount(createHoledTemplate(factory, [createElement(Home, {})]), container)
      const outlet = container.querySelector('[data-testid="page"]')!
      assert.strictEqual(outlet.textContent, "home")
      assert.strictEqual(
        container.querySelectorAll('[data-testid="page"]').length,
        1
      )

      const app = container.__kiruNode!.app!
      app.render(createHoledTemplate(factory, [createElement(About, {})]))
      const pages = container.querySelectorAll('[data-testid="page"]')
      assert.strictEqual(pages.length, 1)
      assert.strictEqual(pages[0]?.textContent, "about")
    })
  })

  it("holed shell matches renderToString of equivalent tree", () => {
    const staticPart = createElement("span", { children: "A" })
    const dynamicPart = createElement("span", { className: "dyn", children: "B" })
    const full = createElement("div", {
      children: [staticPart, dynamicPart],
    })
    const shell = renderToString(full)
    const html = `<div><span>A</span>${KIRU_HOLE_MARKER}</div>`
    assert.ok(shell.includes("<span>A</span>"))
    assert.ok(shell.includes('class="dyn"'))
    const tplOnly = renderToString(_template(html, 1)())
    assert.strictEqual(tplOnly, html)
  })
})
