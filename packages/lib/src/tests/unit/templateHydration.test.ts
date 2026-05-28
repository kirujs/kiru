import { describe, it } from "node:test"
import assert from "node:assert"
import { createElement } from "../../element.js"
import { headlessRender } from "../../headlessRender.js"
import { _template, createHoledTemplate } from "../../template.js"
import { hydrate } from "../../ssr/client.js"
import { countStructuralWalkOps, StructuralWalkOp } from "../../templateStructuralWalk.js"
import { KIRU_HOLE_MARKER } from "../../utils/staticHtml.js"
import { withJSDOM } from "./jsdom.js"

describe("template hydration", () => {
  it("ensureTemplateVNodeHydrated projects nodes from structuralWalk", async () => {
    await withJSDOM(async (container, kiru) => {
      const html = `<div><p>ok</p></div>`
      const tpl = _template(html, 0, 1)
      assert.ok(tpl.structuralWalk?.length)
      kiru.mount(tpl, container)
      const host = container.querySelector("div") as Element & {
        __kiruNode?: Kiru.VNode
      }
      const vnode = host.__kiruNode!
      assert.ok(vnode.templateHydrated)
      assert.strictEqual(vnode.templateHydrated!.nodes[0], host.querySelector("p"))
    })
  })

  it("hydrates holed template from SSR HTML with bindings", async () => {
    await withJSDOM(async (container) => {
      let clicks = 0
      const html = `<div><button type="button">Go</button>${KIRU_HOLE_MARKER}</div>`
      const tpl = createHoledTemplate(
        _template(html, 1, 1),
        [createElement("span", { className: "dyn", children: "live" })],
        undefined,
        [{ kind: "event", prop: "onclick", nodeIndex: 0 }],
        [{ onclick: () => clicks++ }]
      )
      assert.ok(tpl.structuralWalk?.length)
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, tpl)
      container.innerHTML = ssr
      hydrate(tpl, container)
      container.querySelector("button")!.click()
      assert.strictEqual(clicks, 1)
      assert.strictEqual(container.querySelector(".dyn")?.textContent, "live")
    })
  })

  it("hydrates component hole payloads under hole cursor context", async () => {
    await withJSDOM(async (container) => {
      const NavLink = (props: { to: string; children: string }) =>
        createElement("a", { href: props.to, children: props.children })
      const html = `<main><nav>${KIRU_HOLE_MARKER} | ${KIRU_HOLE_MARKER}</nav>${KIRU_HOLE_MARKER}</main>`
      const tpl = createHoledTemplate(_template(html, 3), [
        createElement(NavLink, { to: "/", children: "Home" }),
        createElement(NavLink, { to: "/about", children: "About" }),
        createElement("section", { className: "outlet", children: "Outlet" }),
      ])
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, tpl)
      container.innerHTML = ssr
      hydrate(tpl, container)
      const nav = container.querySelector("nav")!
      assert.strictEqual(
        nav.querySelector('a[href="/"]')?.textContent,
        "Home"
      )
      assert.strictEqual(
        nav.querySelector('a[href="/about"]')?.textContent,
        "About"
      )
      assert.strictEqual(
        container.querySelector(".outlet")?.textContent,
        "Outlet"
      )
    })
  })

  it("keeps static p wrappers between node holes (forms-demo shape)", async () => {
    await withJSDOM(async (container) => {
      const formA = createElement("form", {
        "data-testid": "form-a",
        children: createElement("button", { type: "submit", children: "A" }),
      })
      const formB = createElement("form", {
        "data-testid": "form-b",
        children: createElement("button", { type: "submit", children: "B" }),
      })
      const html = `<section>${KIRU_HOLE_MARKER}<p data-testid="between"><!--#--></p>${KIRU_HOLE_MARKER}</section>`
      const tpl = createHoledTemplate(_template(html, 3, 1), [
        formA,
        "ok",
        formB,
      ], [
        { kind: "node", anchor: 0 },
        { kind: "conditional", anchor: 1 },
        { kind: "node", anchor: 2 },
      ])
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, tpl)
      container.innerHTML = ssr
      hydrate(tpl, container)
      assert.ok(container.querySelector('[data-testid="form-a"]'))
      assert.ok(container.querySelector('[data-testid="form-b"]'))
      assert.ok(container.querySelector('[data-testid="between"]'))
      assert.strictEqual(
        container.querySelector('[data-testid="between"]')?.textContent,
        "ok"
      )
    })
  })

  it("hydrates template shell payload under hole cursor context", async () => {
    await withJSDOM(async (container) => {
      const homeTpl = _template(`<p data-testid="ssr-home">SSR e2e home</p>`, 0, 0)
      const shell = createHoledTemplate(_template(`<div>${KIRU_HOLE_MARKER}</div>`, 1), [
        createElement("main", {
          children: [
            createElement("p", { "data-testid": "ssr-user", children: "User: none" }),
            homeTpl,
            createElement("p", {
              "data-testid": "ssr-remote-result",
              children: "",
            }),
          ],
        }),
      ])
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, shell)
      container.innerHTML = ssr
      hydrate(shell, container)
      assert.strictEqual(
        container.querySelector('[data-testid="ssr-home"]')?.textContent,
        "SSR e2e home"
      )
      assert.strictEqual(
        container.querySelector('[data-testid="ssr-user"]')?.textContent,
        "User: none"
      )
    })
  })

  it("keeps ssr-home vnode/dom ownership before ssr-user hydration", async () => {
    await withJSDOM(async (container) => {
      const homeTpl = _template(`<p data-testid="ssr-home">SSR e2e home</p>`, 0, 0)
      const shell = createHoledTemplate(
        _template(`<main>${KIRU_HOLE_MARKER}</main>`, 1),
        [
          [
            homeTpl,
            createElement("p", {
              "data-testid": "ssr-user",
              children: "User: none",
            }),
            createElement("button", {
              "data-testid": "ssr-remote-button",
              children: "Call remote",
            }),
            createElement("p", {
              "data-testid": "ssr-remote-result",
              children: "",
            }),
          ],
        ]
      )
      let ssr = ""
      headlessRender({ write: (c) => (ssr += c) }, shell)
      container.innerHTML = ssr
      ;(window as typeof window & { __kiruHydrationTrace?: unknown[] }).__kiruHydrationTrace =
        []
      hydrate(shell, container)

      const home = container.querySelector('[data-testid="ssr-home"]')
      const user = container.querySelector('[data-testid="ssr-user"]')
      assert.ok(home)
      assert.ok(user)
      assert.notStrictEqual(home, user)

      const trace = (
        window as typeof window & { __kiruHydrationTrace?: unknown[] }
      ).__kiruHydrationTrace
      assert.ok(Array.isArray(trace) || trace === undefined)
    })
  })

  it("structuralWalk Element count matches structuralNodeCount on factory", () => {
    const html = `<div><span>A</span>${KIRU_HOLE_MARKER}<button>B</button></div>`
    const tpl = _template(html, 1, 2)
    assert.ok(tpl.structuralWalk)
    assert.strictEqual(
      countStructuralWalkOps(tpl.structuralWalk, StructuralWalkOp.Element),
      2
    )
    assert.strictEqual(
      countStructuralWalkOps(tpl.structuralWalk, StructuralWalkOp.Hole),
      1
    )
  })
})
