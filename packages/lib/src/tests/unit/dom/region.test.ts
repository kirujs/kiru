import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"
import { KIRU_HOLE_COMMENT_DATA } from "../../../template.js"

describe("domRuntime/region", () => {
  it("mounts before anchor and preserves anchor on unmount", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createRegion } = await import("../../../domRuntime/region.js")
      const { createComponent } = await import("../../../domRuntime/component.js")

      mount(() => {
        const shell = document.createElement("div")
        const anchor = document.createComment(KIRU_HOLE_COMMENT_DATA)
        shell.appendChild(document.createElement("p"))
        shell.appendChild(anchor)
        container.appendChild(shell)

        const region = createRegion(anchor)
        const child = createComponent(() => {
          const el = document.createElement("span")
          el.className = "child"
          el.textContent = "hi"
          return el
        }, {})

        region.mount(child)
        assert.strictEqual(region.current, child)
        assert.ok(container.querySelector(".child"))
        assert.ok(
          Array.from(shell.childNodes).some(
            (n) => n.nodeType === Node.COMMENT_NODE
          )
        )

        region.unmount()
        assert.strictEqual(region.current, null)
        assert.strictEqual(container.querySelector(".child"), null)
        assert.ok(
          Array.from(shell.childNodes).some(
            (n) =>
              n.nodeType === Node.COMMENT_NODE &&
              (n as Comment).data === KIRU_HOLE_COMMENT_DATA
          )
        )

        region.unmount()
        return shell
      }, container)
    })
  })

  it("swap disposes previous component handle", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createRegion } = await import("../../../domRuntime/region.js")
      const { createComponent } = await import("../../../domRuntime/component.js")

      mount(() => {
        const anchor = document.createComment(KIRU_HOLE_COMMENT_DATA)
        container.appendChild(anchor)
        const region = createRegion(anchor)

        const first = createComponent(() => {
          const el = document.createElement("span")
          el.className = "first"
          return el
        }, {})
        region.mount(first)
        assert.strictEqual(first.owner.disposed, false)
        const second = createComponent(() => {
          const el = document.createElement("span")
          el.className = "second"
          return el
        }, {})
        region.mount(second)

        assert.strictEqual(first.owner.disposed, true)
        assert.strictEqual(container.querySelector(".first"), null)
        assert.ok(container.querySelector(".second"))
        return document.createElement("div")
      }, container)
    })
  })
})
