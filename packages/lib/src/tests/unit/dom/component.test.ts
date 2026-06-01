import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

const MINI_HTML = `<div class="mini">
  <span class="value">0</span>
  <button class="btn" type="button">+</button>
</div>`

describe("domRuntime/component", () => {
  it("dispose stops child domEffect and event listeners", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { template, clone, project } = await import(
        "../../../domRuntime/template.js"
      )
      const { domEffect } = await import("../../../domRuntime/effect.js")
      const { on } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const $t0 = template(MINI_HTML)
      let effectRuns = 0
      let clicks = 0
      let child: import("../../../domRuntime/types.js").ComponentHandle | null =
        null

      mount(() => {
        child = createComponent(() => {
          const count = signal(0)
          const root = clone($t0)
          const { nodes } = project($t0, root)
          domEffect(() => {
            effectRuns++
            nodes[0]!.textContent = String(count())
          })
          on(nodes[1]!, "click", () => {
            clicks++
            count.set((c: number) => c + 1)
          })
          return root
        }, {})
        const wrap = document.createElement("div")
        wrap.appendChild(child.getRoot() as Element)
        return wrap
      }, container)

      await Promise.resolve()
      tick()

      ;(container.querySelector(".btn") as HTMLButtonElement).click()
      await Promise.resolve()
      tick()
      assert.strictEqual(clicks, 1)
      assert.strictEqual(container.querySelector(".value")?.textContent, "1")

      const runsBeforeDispose = effectRuns
      child!.dispose()
      assert.strictEqual(container.querySelector(".mini"), null)

      ;(document.querySelector(".btn") as HTMLButtonElement | null)?.click()
      await Promise.resolve()
      tick()
      assert.strictEqual(clicks, 1)
      assert.strictEqual(effectRuns, runsBeforeDispose)
    })
  })

  it("nested child dispose runs inner cleanups", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { domEffect } = await import("../../../domRuntime/effect.js")
      const { tick } = await import("../../../signals/utils.js")

      const order: string[] = []
      let inner: import("../../../domRuntime/types.js").ComponentHandle | null =
        null

      mount(() => {
        createComponent(() => {
          domEffect(() => {
            order.push("outer-run")
            return () => order.push("outer-cleanup")
          })
          inner = createComponent(() => {
            domEffect(() => {
              order.push("inner-run")
              return () => order.push("inner-cleanup")
            })
            const el = document.createElement("span")
            el.className = "inner"
            return el
          }, {})
          const wrap = document.createElement("div")
          wrap.appendChild(inner.getRoot() as Element)
          return wrap
        }, {})
        return document.createElement("div")
      }, container)

      await Promise.resolve()
      tick()
      assert.ok(order.includes("inner-run"))

      inner!.dispose()
      assert.strictEqual(order.includes("inner-cleanup"), true)
      assert.strictEqual(container.querySelector(".inner"), null)
    })
  })

  it("anchor auto-mounts regular component before marker", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { tick } = await import("../../../signals/utils.js")

      mount(() => {
        const wrap = document.createElement("div")
        wrap.innerHTML = "<h1>Title</h1><!--#--><footer>F</footer>"
        container.appendChild(wrap)
        const anchor = wrap.childNodes[1] as Comment
        createComponent(
          () => {
            const span = document.createElement("span")
            span.className = "child"
            span.textContent = "child"
            return span
          },
          {},
          anchor
        )
        return wrap
      }, container)

      await Promise.resolve()
      tick()

      const wrap = container.querySelector("div")!
      assert.strictEqual(wrap.querySelector("h1")!.textContent, "Title")
      assert.strictEqual(wrap.querySelector(".child")!.textContent, "child")
      assert.strictEqual(wrap.querySelector("footer")!.textContent, "F")
      assert.strictEqual(
        wrap.querySelector(".child")!.compareDocumentPosition(
          wrap.querySelector("footer")!
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
        Node.DOCUMENT_POSITION_FOLLOWING
      )
      assert.strictEqual(wrap.childNodes[2]!.nodeType, Node.COMMENT_NODE)
    })
  })
})
