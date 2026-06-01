import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

const COUNTER_HTML = `<div class="counter-item" data-testid="counter">
  <span class="counter-value">0</span>
  <button class="increment" type="button" data-testid="increment">+</button>
  <button class="decrement" type="button" data-testid="decrement">-</button>
</div>`

describe("domRuntime/counter", () => {
  it("updates text via domEffect and handles button clicks", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { template, clone, project } = await import(
        "../../../domRuntime/template.js"
      )
      const { domEffect } = await import("../../../domRuntime/effect.js")
      const { on } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const $t0 = template(COUNTER_HTML)
      const count = signal(0)

      const app = mount(() => {
        const root = clone($t0)
        const { nodes } = project($t0, root)
        const valueEl = nodes[0]!
        const increment = nodes[1]!
        const decrement = nodes[2]!

        domEffect(() => {
          valueEl.textContent = String(count())
        })

        on(increment, "click", () => count.set((c: number) => c + 1))
        on(decrement, "click", () => count.set((c: number) => c - 1))

        return root
      }, container)

      await Promise.resolve()
      tick()

      const value = container.querySelector(".counter-value")
      assert.strictEqual(value?.textContent, "0")

      ;(container.querySelector('[data-testid="increment"]') as HTMLButtonElement).click()
      await Promise.resolve()
      tick()
      assert.strictEqual(value?.textContent, "1")

      ;(container.querySelector('[data-testid="decrement"]') as HTMLButtonElement).click()
      await Promise.resolve()
      tick()
      assert.strictEqual(value?.textContent, "0")

      app.unmount()
    })
  })

  it("domEffect cleanup runs on unmount", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { domEffect } = await import("../../../domRuntime/effect.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const count = signal(0)
      let effectRuns = 0
      let cleaned = false

      const app = mount(() => {
        const el = document.createElement("span")
        domEffect(() => {
          effectRuns++
          count()
          return () => {
            cleaned = true
          }
        })
        return el
      }, container)

      await Promise.resolve()
      tick()
      assert.ok(effectRuns >= 1)

      app.unmount()
      assert.strictEqual(cleaned, true)
    })
  })
})
