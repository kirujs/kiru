import { describe, it } from "node:test"
import assert from "node:assert"
import {
  StructuralWalkOp,
  buildStructuralWalkFromMarkup,
  countStructuralWalkOps,
  executeStructuralControlStream,
} from "../../templateStructuralWalk.js"
import { KIRU_HOLE_MARKER } from "../../utils/staticHtml.js"
import { withJSDOM } from "./jsdom.js"

describe("structural control stream", () => {
  it("buildStructuralWalkFromMarkup matches element and hole counts", () => {
    const html = `<div><button></button>${KIRU_HOLE_MARKER}<p></p></div>`
    const walk = buildStructuralWalkFromMarkup(html, { excludeShellRoot: true })
    assert.strictEqual(
      countStructuralWalkOps(walk, StructuralWalkOp.Element),
      2
    )
    assert.strictEqual(countStructuralWalkOps(walk, StructuralWalkOp.Hole), 1)
    assert.ok(countStructuralWalkOps(walk, StructuralWalkOp.Leave) > 0)
  })

  it("executeStructuralControlStream projects nodes and anchors", async () => {
    await withJSDOM(async () => {
      const html = `<div><span id="a"></span>${KIRU_HOLE_MARKER}<b></b></div>`
      const walk = buildStructuralWalkFromMarkup(html, { excludeShellRoot: true })
      const container = document.createElement("div")
      container.innerHTML = `<div><span id="a"></span>${KIRU_HOLE_MARKER}<em>dyn</em><b></b></div>`
      const root = container.firstElementChild as Element
      const { nodes, anchors } = executeStructuralControlStream(root, walk)
      assert.strictEqual(nodes.length, 2)
      assert.strictEqual(nodes[0]?.id, "a")
      assert.strictEqual(nodes[1]?.tagName, "EM")
      assert.strictEqual(anchors.length, 1)
    })
  })

  it("projects nested nav holes before sibling shell hole", async () => {
    await withJSDOM(async () => {
      const html = `<main><nav>${KIRU_HOLE_MARKER} | ${KIRU_HOLE_MARKER}</nav>${KIRU_HOLE_MARKER}</main>`
      const walk = buildStructuralWalkFromMarkup(html, { excludeShellRoot: true })
      const container = document.createElement("div")
      container.innerHTML = html
      const root = container.firstElementChild as Element
      const { nodes, anchors } = executeStructuralControlStream(root, walk)
      assert.strictEqual(nodes.length, 1)
      assert.strictEqual(nodes[0]?.tagName, "NAV")
      assert.strictEqual(anchors.length, 3)
      const nav = root.querySelector("nav")!
      assert.strictEqual(anchors[0]?.parentNode, nav)
      assert.strictEqual(anchors[1]?.parentNode, nav)
      assert.strictEqual(anchors[2]?.parentNode, root)
    })
  })
})
