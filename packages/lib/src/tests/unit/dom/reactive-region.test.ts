import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"
import { KIRU_HOLE_COMMENT_DATA } from "../../../template.js"

describe("domRuntime/reactive-region", () => {
  it("domShow toggles mount and teardown on signal change", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { domShow } = await import("../../../domRuntime/region.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const visible = signal(false)
      let mountCount = 0

      mount(() => {
        const shell = document.createElement("div")
        const anchor = document.createComment(KIRU_HOLE_COMMENT_DATA)
        shell.appendChild(anchor)
        domShow(visible, anchor, () =>
          createComponent(() => {
            mountCount++
            const el = document.createElement("span")
            el.className = "shown"
            el.textContent = "on"
            return el
          }, {})
        )
        return shell
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".shown"), null)

      visible.set(true)
      await Promise.resolve()
      tick()
      assert.ok(container.querySelector(".shown"))
      assert.strictEqual(mountCount, 1)

      visible.set(false)
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".shown"), null)

      visible.set(true)
      await Promise.resolve()
      tick()
      assert.ok(container.querySelector(".shown"))
      assert.strictEqual(mountCount, 2)
    })
  })

  it("domEffect region pattern disposes child when branch turns off", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createRegion } = await import("../../../domRuntime/region.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { domEffect } = await import("../../../domRuntime/effect.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const on = signal(true)
      let innerClicks = 0

      mount(() => {
        const shell = document.createElement("div")
        const anchor = document.createComment(KIRU_HOLE_COMMENT_DATA)
        shell.appendChild(anchor)
        const outlet = createRegion(anchor)
        domEffect(() => {
          if (on()) {
            const child = createComponent(() => {
              const btn = document.createElement("button")
              btn.className = "inner-btn"
              btn.addEventListener("click", () => innerClicks++)
              return btn
            }, {})
            outlet.mount(child)
            return () => outlet.unmount()
          }
          outlet.unmount()
          return undefined
        })
        return shell
      }, container)

      await Promise.resolve()
      tick()
      ;(container.querySelector(".inner-btn") as HTMLButtonElement).click()
      assert.strictEqual(innerClicks, 1)

      on.set(false)
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".inner-btn"), null)

      on.set(true)
      await Promise.resolve()
      tick()
      ;(container.querySelector(".inner-btn") as HTMLButtonElement).click()
      assert.strictEqual(innerClicks, 2)
    })
  })
})
