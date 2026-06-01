import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

describe("domRuntime/bind", () => {
  it("bindValue syncs signal and DOM both ways", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { bindValue } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const draft = signal("hi")

      mount(() => {
        const input = document.createElement("input")
        input.type = "text"
        container.appendChild(input)
        bindValue(input, draft)
        return input
      }, container)

      await Promise.resolve()
      tick()

      const input = container.querySelector("input") as HTMLInputElement
      assert.strictEqual(input.value, "hi")

      draft.set("bye")
      await Promise.resolve()
      tick()
      assert.strictEqual(input.value, "bye")

      input.value = "next"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await Promise.resolve()
      tick()
      assert.strictEqual(draft(), "next")
    })
  })

  it("bindChecked syncs checkbox state", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { bindChecked } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const done = signal(false)

      mount(() => {
        const input = document.createElement("input")
        input.type = "checkbox"
        container.appendChild(input)
        bindChecked(input, done)
        return input
      }, container)

      await Promise.resolve()
      tick()

      const input = container.querySelector("input") as HTMLInputElement
      assert.strictEqual(input.checked, false)

      done.set(true)
      await Promise.resolve()
      tick()
      assert.strictEqual(input.checked, true)

      input.checked = false
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      tick()
      assert.strictEqual(done(), false)
    })
  })

  it("bindValue cleanup on unmount stops sync", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { bindValue } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const draft = signal("a")
      const input = document.createElement("input")

      const app = mount(() => {
        bindValue(input, draft)
        return input
      }, container)

      await Promise.resolve()
      tick()
      draft.set("b")
      await Promise.resolve()
      tick()
      assert.strictEqual(input.value, "b")

      app.unmount()
      draft.set("c")
      await Promise.resolve()
      tick()
      assert.strictEqual(input.value, "b")
    })
  })
})
