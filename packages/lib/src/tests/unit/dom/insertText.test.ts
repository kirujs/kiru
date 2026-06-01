import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

describe("domRuntime/insertText", () => {
  it("updates text reactively", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const label = signal("hello")

      mount(() => {
        const span = document.createElement("span")
        container.appendChild(span)
        insertText(span, () => label())
        return span
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector("span")!.textContent, "hello")

      label.set("world")
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector("span")!.textContent, "world")
    })
  })
})
