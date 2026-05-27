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
import { signal } from "../../signals/index.js"
import { withJSDOM } from "./jsdom.js"

const linkManifest = compileRouteTree(
  createRouteTree({
    children: [createRoute("/", async () => ({ default: () => null }))],
  })
)

describe("template holes", () => {
  it("headlessRender writes hole markers when there are no hole children", () => {
    const html = `<div><span>A</span>${KIRU_HOLE_MARKER}</div>`
    const tpl = _template(html, 1)
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
      const host = container.querySelector("div") as Element & {
        __kiruNode?: Kiru.VNode
      }
      const hostVNode = host.__kiruNode!
      const holeHost = hostVNode.templateHoleHosts?.[0]
      assert.ok(holeHost, "expected retained hole host parent")
      assert.strictEqual(holeHost!.parent, hostVNode)
      assert.strictEqual(hostVNode.templateHoleHeads?.[0]?.parent, holeHost)
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

  it("mounts mixed holes before static siblings (Counter-shaped shell)", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><h1>${KIRU_HOLE_MARKER}</h1>${KIRU_HOLE_MARKER}<span class="badge">OK</span><div>123</div></div>`
      const factory = _template(html, 2)
      const count = kiru.signal(0)
      const button = createElement("button", {
        onclick: () => {},
        children: "Increment",
      })

      kiru.mount(
        createHoledTemplate(
          factory,
          [["Count: ", count], button],
          [
            { kind: "text", anchor: 0 },
            { kind: "node", anchor: 1 },
          ]
        ),
        container
      )

      const root = container.querySelector("div")!
      const h1 = root.querySelector("h1")!
      assert.ok(h1.textContent?.includes("Count:"))
      assert.strictEqual(root.querySelector("button")?.textContent, "Increment")
      assert.strictEqual(
        root.querySelector("span.badge")?.textContent,
        "OK"
      )
      assert.strictEqual(root.querySelector("div:last-child")?.textContent, "123")
      const countComments = (node: Node): number => {
        let count = 0
        const walk = (n: Node) => {
          if (n.nodeType === Node.COMMENT_NODE && (n as Comment).data === "#") {
            count++
          }
          for (const child of n.childNodes) walk(child)
        }
        walk(node)
        return count
      }
      assert.ok(
        countComments(root) >= 2,
        "hole anchors remain in the shell"
      )
      assert.ok(
        h1.compareDocumentPosition(root.querySelector("button")!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
      assert.ok(
        (root.querySelector("button")!.compareDocumentPosition(
          root.querySelector("div:last-child")!
        ) &
          Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      )
      const rootHtml = root.innerHTML
      const buttonPos = rootHtml.indexOf("<button")
      const badgePos = rootHtml.indexOf('<span class="badge">OK</span>')
      const staticPos = rootHtml.indexOf("<div>123</div>")
      assert.ok(buttonPos !== -1, "button hole must mount")
      assert.ok(badgePos !== -1, "static badge must remain in shell")
      assert.ok(staticPos !== -1, "static <div>123</div> must remain in shell")
      assert.ok(
        buttonPos < badgePos && badgePos < staticPos,
        "button hole must mount before static badge and static <div>123</div>"
      )
      assert.strictEqual(
        h1.textContent,
        "Count: 0",
        "text hole must mount inside <h1>"
      )
      assert.ok(
        ![...root.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").includes("Count:")
        ),
        "text hole must not be appended at the root level"
      )
    })
  })

  it("mounts module-hoisted element reference at a template hole", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<section data-testid="hoist-hole">${KIRU_HOLE_MARKER}</section>`
      const factory = _template(html, 1)
      const hoistedButton = createElement("button", {
        onclick: () => {},
        children: "Increment",
      })

      kiru.mount(createHoledTemplate(factory, [hoistedButton]), container)

      const root = container.querySelector('[data-testid="hoist-hole"]')!
      assert.strictEqual(root.querySelector("button")?.textContent, "Increment")
      assert.ok(
        [...root.childNodes].some((n) => n.nodeType === Node.COMMENT_NODE)
      )
    })
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

  it("App shell: nested AnotherCounter badge stays inside component hole subtree", async () => {
    await withJSDOM(async (container, kiru) => {
      const anotherHtml = `<div><h1>${KIRU_HOLE_MARKER}</h1>${KIRU_HOLE_MARKER}<span class="badge">OK</span></div>`
      const count = kiru.signal(0)
      const button = createElement("button", {
        onclick: () => {},
        children: "Increment",
      })
      const AnotherCounter = () =>
        createHoledTemplate(
          _template(anotherHtml, 2),
          [["Count: ", count], button],
          [
            { kind: "text", anchor: 0 },
            { kind: "node", anchor: 1 },
          ]
        )

      const appHtml = `<div><h1>Static content</h1>${KIRU_HOLE_MARKER}${KIRU_HOLE_MARKER}</div>`
      const toggle = createElement("button", { children: "Toggle" })
      kiru.mount(
        createHoledTemplate(
          _template(appHtml, 2),
          [toggle, createElement(AnotherCounter, {})],
          [
            { kind: "node", anchor: 0 },
            { kind: "component", anchor: 1 },
          ]
        ),
        container
      )

      const root = container.querySelector("div")!
      assert.strictEqual(
        root.querySelector(":scope > h1")?.textContent,
        "Static content"
      )
      assert.strictEqual(
        root.querySelector(":scope > button")?.textContent,
        "Toggle"
      )

      const h1s = root.querySelectorAll("h1")
      assert.strictEqual(h1s.length, 2)
      assert.strictEqual(h1s[1]!.textContent, "Count: 0")

      const badges = root.querySelectorAll("span.badge")
      assert.strictEqual(badges.length, 1, "badge must not duplicate outside subtree")
      assert.ok(
        h1s[1]!.parentElement?.contains(badges[0]!),
        "badge must live inside AnotherCounter shell"
      )

      const rootHtml = root.innerHTML
      const staticH1Pos = rootHtml.indexOf("Static content")
      const anotherH1Pos = rootHtml.indexOf("Count: 0")
      const badgePos = rootHtml.indexOf('<span class="badge">OK</span>')
      assert.ok(
        staticH1Pos < anotherH1Pos && anotherH1Pos < badgePos,
        "DOM order: app static, then AnotherCounter content, then badge"
      )
    })
  })

  it("mounts component hole at its own anchor among static siblings", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><h1>${KIRU_HOLE_MARKER}</h1>${KIRU_HOLE_MARKER}<span class="badge">OK</span><div>123</div>${KIRU_HOLE_MARKER}</div>`
      const factory = _template(html, 3)
      const count = kiru.signal(0)
      const button = createElement("button", {
        onclick: () => {},
        children: "Increment",
      })
      const AnotherCounter = () =>
        createElement("section", {
          "data-testid": "another-counter",
          children: "Another",
        })

      kiru.mount(
        createHoledTemplate(
          factory,
          [["Count: ", count], button, createElement(AnotherCounter, {})],
          [
            { kind: "text", anchor: 0 },
            { kind: "node", anchor: 1 },
            { kind: "component", anchor: 2 },
          ]
        ),
        container
      )

      const root = container.querySelector("div")!
      const h1 = root.querySelector("h1")!
      const another = root.querySelector('[data-testid="another-counter"]')
      assert.strictEqual(h1.textContent, "Count: 0")
      assert.ok(another, "component hole should mount")

      const rootHtml = root.innerHTML
      const anotherPos = rootHtml.indexOf('data-testid="another-counter"')
      const badgePos = rootHtml.indexOf('<span class="badge">OK</span>')
      const staticPos = rootHtml.indexOf("<div>123</div>")
      assert.ok(anotherPos !== -1, "component hole should be in root html")
      assert.ok(badgePos !== -1, "static badge should be in root html")
      assert.ok(staticPos !== -1, "static div should be in root html")
      assert.ok(
        badgePos < staticPos && staticPos < anotherPos,
        "component hole must mount at anchor 2 (after static siblings)"
      )
    })
  })

  it("preserves trailing component hole when middle conditional hole turns on", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><h1>Static content</h1>${KIRU_HOLE_MARKER}${KIRU_HOLE_MARKER}${KIRU_HOLE_MARKER}</div>`
      const factory = _template(html, 3)
      const button = createElement("button", { children: "Toggle" })
      const Counter = () =>
        createElement("section", {
          "data-testid": "counter-hole",
          children: "counter",
        })
      const AnotherCounter = () =>
        createElement("section", {
          "data-testid": "another-hole",
          children: "another",
        })
      const regions = [
        { kind: "node", anchor: 0 },
        { kind: "conditional", anchor: 1 },
        { kind: "component", anchor: 2 },
      ] as const

      kiru.mount(
        createHoledTemplate(factory, [button, false, createElement(AnotherCounter, {})], regions),
        container
      )
      assert.strictEqual(
        container.querySelector('[data-testid="another-hole"]')?.textContent,
        "another"
      )

      const app = container.__kiruNode!.app!
      app.render(
        createHoledTemplate(
          factory,
          [button, createElement(Counter, {}), createElement(AnotherCounter, {})],
          regions
        )
      )

      assert.strictEqual(
        container.querySelector('[data-testid="counter-hole"]')?.textContent,
        "counter"
      )
      assert.strictEqual(
        container.querySelector('[data-testid="another-hole"]')?.textContent,
        "another"
      )
      const root = container.querySelector("div")!
      const rootHtml = root.innerHTML
      const counterPos = rootHtml.indexOf('data-testid="counter-hole"')
      const anotherPos = rootHtml.indexOf('data-testid="another-hole"')
      assert.ok(counterPos !== -1 && anotherPos !== -1, rootHtml)
      assert.ok(counterPos < anotherPos, "middle conditional hole must not displace trailing hole")
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

  it("ignores nested template hole markers inside a shell hole", async () => {
    await withJSDOM(async (container, kiru) => {
      const outerHtml = `<div>${KIRU_HOLE_MARKER}${KIRU_HOLE_MARKER}</div>`
      const innerHtml = `<section>${KIRU_HOLE_MARKER}</section>`
      const Page = () =>
        createElement("p", { "data-testid": "page", children: "nested" })
      const makeOuter = () =>
        createHoledTemplate(_template(outerHtml, 2), [
          createElement("span", { children: "static" }),
          createHoledTemplate(_template(innerHtml, 1), [
            createElement(Page, {}),
          ]),
        ])
      kiru.mount(makeOuter(), container)
      const app = container.__kiruNode!.app!
      assert.doesNotThrow(() => app.render(makeOuter()))
    })
  })

  it("applies template bindings to static event hosts without a hole vnode", async () => {
    await withJSDOM(async (container, kiru) => {
      let clicks = 0
      const html = `<div><button type="button">Click</button></div>`
      const tpl = createHoledTemplate(
        _template(html, 0),
        [],
        undefined,
        [{ kind: "event", prop: "onclick", nodeIndex: 0 }],
        [{ onclick: () => clicks++ }]
      )
      kiru.mount(tpl, container)
      const btn = container.querySelector("button")!
      assert.strictEqual(btn.textContent, "Click")
      btn.click()
      assert.strictEqual(clicks, 1)
      assert.strictEqual(
        container.querySelectorAll("button").length,
        1,
        "behavior-only host must not mount a second button via a hole"
      )
    })
  })

  it("reuses cached structural map across binding updates", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><button>Go</button></div>`
      const factory = _template(html, 0)
      let generation = 0
      const makeTpl = () =>
        createHoledTemplate(
          factory,
          [],
          undefined,
          [{ kind: "event", prop: "onclick", nodeIndex: 0 }],
          [{ onclick: () => generation++ }]
        )
      kiru.mount(makeTpl(), container)
      const root = container.querySelector("div") as Element & {
        __kiruNode?: Kiru.VNode
      }
      const vnode = root.__kiruNode!
      const map = vnode.templateStructuralNodes
      assert.ok(map?.length === 1)
      assert.strictEqual(map[0], container.querySelector("button"))
      const app = container.__kiruNode!.app!
      app.render(makeTpl())
      assert.strictEqual(vnode.templateStructuralNodes, map)
      container.querySelector("button")!.click()
      assert.strictEqual(generation, 1)
    })
  })

  it("ref callback attaches to inlined template element at nodeIndex 0", async () => {
    await withJSDOM(async (container, kiru) => {
      let attached: HTMLButtonElement | null = null
      const html = `<div><button type="button">Save</button></div>`
      const tpl = createHoledTemplate(
        _template(html, 0, 1),
        [],
        undefined,
        [{ kind: "ref", prop: "ref", nodeIndex: 0 }],
        [{ ref: (el: HTMLButtonElement | null) => (attached = el) }]
      )
      kiru.mount(tpl, container)
      const btn = container.querySelector("button")!
      assert.strictEqual(attached, btn)
    })
  })

  it("bind:value on inlined input updates signal and DOM", async () => {
    await withJSDOM(async (container, kiru) => {
      const value = signal("hi")
      const html = `<div><input type="text" /></div>`
      const tpl = createHoledTemplate(
        _template(html, 0, 1),
        [],
        undefined,
        [{ kind: "bind", prop: "bind:value", nodeIndex: 0 }],
        [{ "bind:value": value }]
      )
      kiru.mount(tpl, container)
      const input = container.querySelector("input") as HTMLInputElement
      assert.strictEqual(input.value, "hi")
      value.set("bye")
      assert.strictEqual(input.value, "bye")
      input.value = "next"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      assert.strictEqual(value(), "next")
    })
  })

  it("nested inlined binding onclick targets correct nodeIndex", async () => {
    await withJSDOM(async (container, kiru) => {
      let clicks = 0
      const html = `<div><h1>Title</h1><button type="button">Go</button></div>`
      const tpl = createHoledTemplate(
        _template(html, 0, 2),
        [],
        undefined,
        [{ kind: "event", prop: "onclick", nodeIndex: 1 }],
        [undefined, { onclick: () => clicks++ }]
      )
      kiru.mount(tpl, container)
      container.querySelector("button")!.click()
      assert.strictEqual(clicks, 1)
    })
  })

  it("hydrates template bindings from structural coordinates", async () => {
    await withJSDOM(async (container) => {
      const html = `<div><button>Save</button></div>`
      let saved = false
      const tpl = createHoledTemplate(
        _template(html, 0),
        [],
        undefined,
        [{ kind: "event", prop: "onclick", nodeIndex: 0 }],
        [{ onclick: () => (saved = true) }]
      )
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, tpl)
      container.innerHTML = ssr
      hydrate(tpl, container)
      container.querySelector("button")!.click()
      assert.strictEqual(saved, true)
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
    const tplOnly = renderToString(_template(html, 1))
    assert.strictEqual(tplOnly, html)
  })
})
