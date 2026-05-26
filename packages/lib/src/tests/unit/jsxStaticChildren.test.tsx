import { describe, it } from "node:test"
import assert from "node:assert"
import { jsx, jsxs } from "../../jsx.js"
import {
  FLAG_HOISTED,
  FLAG_PLACEMENT,
  FLAG_STATIC_CHILDREN,
  FLAG_UPDATE,
  $STATIC_CHILDREN_LIST,
} from "../../constants.js"
import { reconcileChildren } from "../../reconciler.js"
import { createVNode } from "../../vNode.js"
import { commitSnapshot } from "../../utils/index.js"
import { isSignal, signal } from "../../signals/base.js"

const commitChildren = (node: Kiru.VNode) => {
  let n = node.child
  while (n) {
    commitSnapshot(n)
    n = n.sibling
  }
}

describe("jsx static children", () => {
  it("jsxs tags children array with $STATIC_CHILDREN_LIST", () => {
    const el = jsxs("div", {
      children: [jsx("span", { children: "a" })],
    })
    const list = el.props.children as unknown[]
    assert.ok($STATIC_CHILDREN_LIST in list)
  })

  it("jsxs sets FLAG_STATIC_CHILDREN on Element; jsx does not", () => {
    const staticEl = jsxs("div", {
      children: [
        jsx("span", { children: "a" }),
        jsx("span", { children: "b" }),
      ],
    })
    assert.strictEqual(
      staticEl.meta!.flags! & FLAG_STATIC_CHILDREN,
      FLAG_STATIC_CHILDREN
    )

    const dynamicEl = jsx("div", { children: "only" })
    assert.strictEqual(
      (dynamicEl.meta?.flags ?? 0) & FLAG_STATIC_CHILDREN,
      0
    )
  })

  it("propagates static flag from jsxs Element onto host VNode", () => {
    const section = createVNode("section")
    const staticHost = jsxs("div", {
      children: [jsx("p", { children: "hi" })],
    })
    section.child = reconcileChildren(section, staticHost)
    assert.ok(section.child)
    assert.strictEqual(
      section.child!.flags & FLAG_STATIC_CHILDREN,
      FLAG_STATIC_CHILDREN
    )
  })

  it("reconciles static child slots in place without deletions", () => {
    const count = signal(0)
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN

    const mkChildren = () => [
      jsx("span", { children: count }),
      jsx("span", { children: "static" }),
    ]

    host.child = reconcileChildren(host, mkChildren())
    commitChildren(host)

    count.set(1)
    host.child = reconcileChildren(host, mkChildren())
    commitChildren(host)

    assert.strictEqual(host.deletions?.length ?? 0, 0)

    let slot: Kiru.VNode | null = host.child
    let slotCount = 0
    while (slot) {
      slotCount++
      slot = slot.sibling
    }
    assert.strictEqual(slotCount, 2)

    assert.strictEqual(host.child?.type, "span")
    assert.strictEqual(host.child?.props.children, count)
    assert.strictEqual(host.child?.sibling?.type, "span")
    assert.strictEqual(host.child?.sibling?.props.children, "static")
  })

  it("falls back to full reconcile when keyed static slots mismatch", () => {
    const items = ["a", "b"]
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN

    const mk = () => items.map((i) => jsx("div", { key: i, children: i }))

    host.child = reconcileChildren(host, mk())
    commitChildren(host)

    items.reverse()
    host.child = reconcileChildren(host, mk())
    commitChildren(host)

    assert.strictEqual(host.child?.key, "b")
    assert.strictEqual(host.child?.sibling?.key, "a")
  })

  it("steady-state static reconcile skips FLAG_PLACEMENT on children", () => {
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN
    const children = [
      jsx("span", { children: "a" }),
      jsx("span", { children: "b" }),
    ]
    host.child = reconcileChildren(host, children)
    commitChildren(host)
    host.child = reconcileChildren(host, children)
    commitChildren(host)

    let c: Kiru.VNode | null = host.child
    while (c) {
      assert.strictEqual((c.flags & FLAG_PLACEMENT) !== 0, false)
      c = c.sibling
    }
  })

  it("steady-state static reconcile preserves sibling identity", () => {
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN
    const children = [
      jsx("span", { children: "a" }),
      jsx("span", { children: "b" }),
    ]
    host.child = reconcileChildren(host, children)
    commitChildren(host)
    const first = host.child
    const second = host.child?.sibling
    host.child = reconcileChildren(host, children)
    assert.strictEqual(host.child, first)
    assert.strictEqual(host.child?.sibling, second)
  })

  it("static host does not FLAG_UPDATE FC child when props unchanged", () => {
    function Child(props: { n: number }) {
      return jsx("span", { children: String(props.n) })
    }
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN
    const mk = (n: number) => [
      jsx(Child, { n }),
      jsx("span", { children: "x" }),
    ]
    host.child = reconcileChildren(host, mk(1))
    commitChildren(host)
    const fc = host.child!
    host.child = reconcileChildren(host, mk(1))
    assert.strictEqual(host.child, fc)
    assert.strictEqual((fc.flags & FLAG_UPDATE) !== 0, false)
  })

  it("jsx single-child path ignores false children", () => {
    const host = createVNode("div")
    host.child = reconcileChildren(host, false)
    assert.strictEqual(host.child, null)
  })

  it("propagates FLAG_HOISTED from element.meta onto host VNode", () => {
    const el = jsxs("div", { children: [jsx("span", { children: "a" })] })
    el.meta = { flags: FLAG_HOISTED }
    const host = createVNode("section")
    host.child = reconcileChildren(host, el)
    assert.ok(host.child)
    assert.strictEqual(host.child!.flags & FLAG_HOISTED, FLAG_HOISTED)
  })

  it("updates text when a signal is passed as child (signal-as-child)", () => {
    const count = signal(0)
    const host = createVNode("div")
    host.child = reconcileChildren(host, jsx("span", { children: count }))
    commitChildren(host)

    count.set(2)
    host.child = reconcileChildren(host, jsx("span", { children: count }))
    commitChildren(host)

    assert.strictEqual(host.child?.props.children, count)
    assert.ok(isSignal(host.child?.props.children))
  })

  it("compileRegions only reconciles dynamic slots", () => {
    const count = signal(0)
    const children = [
      jsx("span", { children: "static" }),
      jsx("span", { children: count }),
    ]
    const host = createVNode("div")
    host.flags |= FLAG_STATIC_CHILDREN
    host.compileRegions = [{ kind: "insert", slot: 1 }]

    host.child = reconcileChildren(host, children)
    commitChildren(host)
    const staticSlot = host.child
    const dynamicSlot = host.child?.sibling

    count.set(1)
    host.child = reconcileChildren(host, children)
    commitChildren(host)

    assert.strictEqual(host.child, staticSlot)
    assert.strictEqual(host.child?.sibling, dynamicSlot)
    assert.strictEqual(host.deletions?.length ?? 0, 0)
  })
})
