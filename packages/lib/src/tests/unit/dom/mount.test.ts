import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

describe("domRuntime/mount", () => {
  it("mount replaces container children and unmount clears them", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const marker = document.createElement("span")
      marker.textContent = "root"

      const app = mount(() => marker, container, { name: "test" })
      assert.strictEqual(container.firstElementChild, marker)
      assert.strictEqual(app.name, "test")

      app.unmount()
      assert.strictEqual(container.childElementCount, 0)
    })
  })

  it("unmount disposes owner-scoped listeners", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { on } = await import("../../../domRuntime/bind.js")
      const { getCurrentOwner } = await import("../../../domRuntime/owner.js")

      let clicks = 0
      const button = document.createElement("button")

      const app = mount(() => {
        on(button, "click", () => {
          clicks++
        })
        assert.ok(getCurrentOwner())
        return button
      }, container)

      button.click()
      assert.strictEqual(clicks, 1)

      app.unmount()
      button.click()
      assert.strictEqual(clicks, 1)
    })
  })
})
