import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

describe("domRuntime/component props", () => {
  it("(props) => () => el updates insertText when updateProps is called", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { tick } = await import("../../../signals/utils.js")

      let handle: import("../../../domRuntime/types.js").ComponentHandle<{
        label: string
      }> | null = null

      mount(() => {
        handle = createComponent(
          () => (props: { label: string }) => {
            void props
            const { derive } = setupDom<{ label: string }>()
            const label = derive((p) => p.label)
            const span = document.createElement("span")
            span.className = "label"
            insertText(span, () => label())
            return () => span
          },
          { label: "a" }
        )
        container.appendChild(handle.getRoot() as Element)
        return handle.getRoot() as Element
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".label")?.textContent, "a")

      handle!.updateProps({ label: "b" })
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".label")?.textContent, "b")
    })
  })

  it("() => (props) => el runs setupDom derive on updateProps", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { tick } = await import("../../../signals/utils.js")

      let handle: import("../../../domRuntime/types.js").ComponentHandle<{
        n: number
      }> | null = null

      mount(() => {
        handle = createComponent(
          () => {
            const { derive } = setupDom<{ n: number }>()
            const doubled = derive((p) => p.n * 2)
            return (props: { n: number }) => {
              void props
              const span = document.createElement("span")
              span.className = "doubled"
              insertText(span, () => String(doubled()))
              return () => span
            }
          },
          { n: 1 }
        )
        container.appendChild(handle.getRoot() as Element)
        return handle.getRoot() as Element
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".doubled")?.textContent, "2")

      handle!.updateProps({ n: 3 })
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".doubled")?.textContent, "6")
    })
  })

  it("() => (props) => stable el skips repaint on updateProps; derive updates", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      let handle: import("../../../domRuntime/types.js").ComponentHandle<{
        label: string
      }> | null = null
      let renderCalls = 0
      let stableRoot: HTMLSpanElement | undefined

      mount(() => {
        handle = createComponent(
          () => {
            const { derive } = setupDom<{ label: string }>()
            const doubled = derive((p) => p.label + p.label)
            const local = signal("!")
            return (props: { label: string }) => {
              void props
              renderCalls++
              if (!stableRoot) {
                stableRoot = document.createElement("span")
                stableRoot.className = "stable"
                insertText(stableRoot, () => doubled() + local())
              }
              return stableRoot
            }
          },
          { label: "a" }
        )
        container.appendChild(handle.getRoot() as Element)
        return handle.getRoot() as Element
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".stable")?.textContent, "aa!")
      assert.strictEqual(renderCalls, 1)

      handle!.updateProps({ label: "b" })
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".stable")?.textContent, "bb!")
      assert.strictEqual(renderCalls, 2)
      assert.strictEqual(container.querySelector(".stable"), stableRoot)
    })
  })

  it("local signal survives updateProps on () => (props) => render shape", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { on } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      let handle: import("../../../domRuntime/types.js").ComponentHandle<{
        label: string
      }> | null = null

      mount(() => {
        handle = createComponent(
          () => {
            const { derive } = setupDom<{ label: string }>()
            const label = derive((p) => p.label)
            const count = signal(0)
            return (props: { label: string }) => {
              void props
              const wrap = document.createElement("div")
              const value = document.createElement("span")
              value.className = "value"
              const btn = document.createElement("button")
              btn.className = "inc"
              on(btn, "click", () => count.set((c) => c + 1))
              wrap.append(value, btn)
              insertText(value, () => `${label()}:${count()}`)
              return () => wrap
            }
          },
          { label: "x" }
        )
        container.appendChild(handle.getRoot() as Element)
        return handle.getRoot() as Element
      }, container)

      await Promise.resolve()
      tick()
      ;(container.querySelector(".inc") as HTMLButtonElement).click()
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".value")?.textContent, "x:1")

      handle!.updateProps({ label: "y" })
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".value")?.textContent, "y:1")
    })
  })

  it("install-once insertText via setupDom().props updates on updateProps without re-render", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { tick } = await import("../../../signals/utils.js")

      let handle: import("../../../domRuntime/types.js").ComponentHandle<{
        label: string
      }> | null = null
      let renderCalls = 0
      let stableRoot: HTMLSpanElement | undefined

      mount(() => {
        handle = createComponent(
          () => {
            setupDom<{ label: string }>()
            stableRoot = document.createElement("span")
            stableRoot.className = "live-label"
            insertText(
              stableRoot,
              () => setupDom<{ label: string }>().props.label
            )
            return (props: { label: string }) => {
              void props
              renderCalls++
              return stableRoot!
            }
          },
          { label: "a" }
        )
        container.appendChild(handle.getRoot() as Element)
        return handle.getRoot() as Element
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".live-label")?.textContent, "a")
      assert.strictEqual(renderCalls, 1)

      handle!.updateProps({ label: "b" })
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".live-label")?.textContent, "b")
      assert.strictEqual(renderCalls, 2)
    })
  })
})
