import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "../jsdom.js"

describe("domRuntime/for", () => {
  it("createComponent(For, props, anchor) renders rows before anchor", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: 1, text: "a" }])

      mount(() => {
        const wrap = document.createElement("div")
        wrap.innerHTML = "<h1>Title</h1><!--#--><footer>F</footer>"
        container.appendChild(wrap)
        const anchor = wrap.childNodes[1] as Comment
        createComponent(
          For,
          {
            each: items,
            children: (item: { id: number; text: string }) => {
              const li = document.createElement("li")
              li.dataset.id = String(item.id)
              li.textContent = item.text
              return li
            },
          },
          anchor
        )
        return wrap
      }, container)

      await Promise.resolve()
      tick()

      assert.strictEqual(container.querySelector("h1")!.textContent, "Title")
      assert.strictEqual(container.querySelector("footer")!.textContent, "F")
      assert.strictEqual(container.querySelectorAll("li").length, 1)
      assert.strictEqual(
        container.querySelector("li")!.compareDocumentPosition(
          container.querySelector("footer")!
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
  })

  it("shows fallback when each is empty", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal<{ id: number }[]>([])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        const empty = document.createElement("p")
        empty.dataset.testid = "empty"
        empty.textContent = "No items"
        createComponent(
          For,
          {
            each: items,
            fallback: empty,
            children: (item: { id: number }) => {
              const li = document.createElement("li")
              li.textContent = String(item.id)
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.ok(container.querySelector('[data-testid="empty"]'))

      items.set([{ id: 1 }])
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector('[data-testid="empty"]'), null)
      assert.strictEqual(container.querySelectorAll("li").length, 1)
    })
  })

  it("referential defaultKey preserves row identity on reorder", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const a = { id: "a" }
      const b = { id: "b" }
      const items = signal([a, b])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            children: (item: { id: string }) => {
              const li = document.createElement("li")
              li.dataset.id = item.id
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const nodeA = container.querySelector('[data-id="a"]')
      const nodeB = container.querySelector('[data-id="b"]')
      assert.ok(nodeA && nodeB)

      items.set([b, a])
      await Promise.resolve()
      tick()

      assert.strictEqual(container.querySelector('[data-id="a"]'), nodeA)
      assert.strictEqual(container.querySelector('[data-id="b"]'), nodeB)
    })
  })

  it("referential defaultKey creates new row when item object is replaced", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const original = { id: "x", n: 0 }
      const items = signal([original])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            children: (item: { id: string; n: number }) => {
              const li = document.createElement("li")
              li.dataset.id = item.id
              li.dataset.n = String(item.n)
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const firstRow = container.querySelector('[data-id="x"]') as HTMLElement
      assert.ok(firstRow)
      assert.strictEqual(firstRow.dataset.n, "0")

      items.set([{ id: "x", n: 1 }])
      await Promise.resolve()
      tick()

      const nextRow = container.querySelector('[data-id="x"]') as HTMLElement
      assert.notStrictEqual(nextRow, firstRow)
      assert.strictEqual(nextRow.dataset.n, "1")
    })
  })

  it("dispose leaves anchor in DOM", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: 1 }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        const handle = createComponent(
          For,
          {
            each: items,
            children: () => {
              const li = document.createElement("li")
              return li
            },
          },
          anchor
        )
        queueMicrotask(() => handle.dispose())
        return ul
      }, container)

      await Promise.resolve()
      tick()
      await Promise.resolve()
      assert.strictEqual(container.querySelector("ul")!.firstChild!.nodeType, Node.COMMENT_NODE)
    })
  })

  it("inserts and removes rows by explicit key", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "a", label: "A" }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.className = "list"
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: (item: { id: string; label: string }) => {
              const li = document.createElement("li")
              li.className = "row"
              li.dataset.id = item.id
              li.textContent = item.label
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll(".row").length, 1)

      items.set([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll(".row").length, 2)

      items.set([{ id: "b", label: "B" }])
      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll(".row").length, 1)
      assert.strictEqual(
        container.querySelector(".row")?.getAttribute("data-id"),
        "b"
      )
    })
  })

  it("explicit key reorder preserves node identity", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: (item: { id: string }) => {
              const li = document.createElement("li")
              li.dataset.id = item.id
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const nodeA = container.querySelector('[data-id="a"]')
      const nodeB = container.querySelector('[data-id="b"]')
      assert.ok(nodeA && nodeB)

      items.set([
        { id: "b", label: "B" },
        { id: "a", label: "A" },
      ])
      await Promise.resolve()
      tick()

      assert.strictEqual(container.querySelector('[data-id="a"]'), nodeA)
      assert.strictEqual(container.querySelector('[data-id="b"]'), nodeB)
      assert.strictEqual(
        nodeB!.compareDocumentPosition(nodeA!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
  })

  it("LIS reorder minimizes insertBefore calls on rotate", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "a" }, { id: "b" }, { id: "c" }])

      let insertBeforeCalls = 0
      const origInsertBefore = Element.prototype.insertBefore

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        Element.prototype.insertBefore = function (
          this: Element,
          node: Node,
          ref: Node | null
        ) {
          if (this === ul) insertBeforeCalls++
          return origInsertBefore.call(this, node, ref)
        } as typeof Element.prototype.insertBefore
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: (item: { id: string }) => {
              const li = document.createElement("li")
              li.dataset.id = item.id
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      insertBeforeCalls = 0

      items.set([{ id: "b" }, { id: "c" }, { id: "a" }])
      await Promise.resolve()
      tick()

      Element.prototype.insertBefore = origInsertBefore

      assert.ok(
        insertBeforeCalls <= 2,
        `expected at most 2 insertBefore calls, got ${insertBeforeCalls}`
      )
      assert.strictEqual(
        [...container.querySelectorAll("li")].map((el) => el.dataset.id).join(","),
        "b,c,a"
      )
    })
  })

  it("unmount removes all For rows", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "x" }])

      const app = mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: () =>
              createComponent(() => {
                const li = document.createElement("li")
                li.className = "row"
                return li
              }, {}),
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll(".row").length, 1)

      app.unmount()
      assert.strictEqual(container.querySelectorAll(".row").length, 0)
    })
  })

  it("children returning multiple roots mounts all before anchor", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "a" }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: () => {
              const a = document.createElement("p")
              a.className = "prefix"
              a.dataset.id = "a"
              const b = document.createElement("li")
              b.className = "suffix"
              b.dataset.id = "a"
              return [a, b]
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll(".prefix").length, 1)
      assert.strictEqual(container.querySelectorAll(".suffix").length, 1)
      const prefix = container.querySelector(".prefix")!
      const suffix = container.querySelector(".suffix")!
      assert.strictEqual(
        prefix.compareDocumentPosition(suffix) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
  })

  it("children returning empty array inserts no DOM for key", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "ghost" }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            children: () => [],
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelectorAll("ul *").length, 0)
    })
  })

  it("updates row text for same key when item field changes", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: "a", label: "A" }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: (item: { id: string; label: string }) => {
              const li = document.createElement("li")
              li.className = "row"
              li.dataset.id = item.id
              li.textContent = item.label
              return li
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const row = container.querySelector(".row") as HTMLElement
      assert.strictEqual(row.textContent, "A")

      items.set([{ id: "a", label: "B" }])
      await Promise.resolve()
      tick()
      assert.strictEqual(row, container.querySelector(".row"))
      assert.strictEqual(row.textContent, "B")
    })
  })

  it("calls updateProps on reused component row when props change", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { setupDom } = await import("../../../domRuntime/index.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: 1, value: "one" }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: number }) => item.id,
            children: (item: { id: number; value: string }) =>
              createComponent(
                () => (props: { id: number; value: string }) => {
                  void props
                  const { derive } = setupDom<{ id: number; value: string }>()
                  const value = derive((p) => p.value)
                  const span = document.createElement("span")
                  span.className = "value"
                  span.dataset.id = String(props.id)
                  insertText(span, () => value())
                  return () => span
                },
                { id: item.id, value: item.value }
              ),
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const row = container.querySelector('[data-id="1"]') as HTMLElement
      assert.strictEqual(row.textContent, "one")

      items.set([{ id: 1, value: "two" }])
      await Promise.resolve()
      tick()
      assert.strictEqual(
        container.querySelector('[data-id="1"]')?.textContent,
        "two"
      )
    })
  })

  it("insertText in For fragment child runs without owner error", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { insertText } = await import("../../../domRuntime/bind.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const items = signal([{ id: 1 }])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: number }) => item.id,
            children: (item: { id: number }) => {
              const badge = document.createElement("p")
              badge.className = "badge"
              insertText(badge, () => String(item.id))
              const row = document.createElement("li")
              row.className = "row"
              return [badge, row]
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      assert.strictEqual(container.querySelector(".badge")?.textContent, "1")
    })
  })

  it("multi-root reorder preserves node identity", async () => {
    await withJSDOM(async (container) => {
      const { mount } = await import("../../../domRuntime/mount.js")
      const { createComponent } = await import("../../../domRuntime/component.js")
      const { For } = await import("../../../domRuntime/for.js")
      const { signal } = await import("../../../signals/index.js")
      const { tick } = await import("../../../signals/utils.js")

      const a = { id: "a" }
      const b = { id: "b" }
      const items = signal([a, b])

      mount(() => {
        const ul = document.createElement("ul")
        ul.appendChild(document.createComment(""))
        container.appendChild(ul)
        const anchor = ul.firstChild as Comment
        createComponent(
          For,
          {
            each: items,
            key: (item: { id: string }) => item.id,
            children: (item: { id: string }) => {
              const p = document.createElement("p")
              p.dataset.id = item.id
              const li = document.createElement("li")
              li.dataset.id = item.id
              return [p, li]
            },
          },
          anchor
        )
        return ul
      }, container)

      await Promise.resolve()
      tick()
      const pA = container.querySelector('p[data-id="a"]')
      const liA = container.querySelector('li[data-id="a"]')
      const pB = container.querySelector('p[data-id="b"]')
      assert.ok(pA && liA && pB)

      items.set([b, a])
      await Promise.resolve()
      tick()

      assert.strictEqual(container.querySelector('p[data-id="a"]'), pA)
      assert.strictEqual(container.querySelector('li[data-id="a"]'), liA)
    })
  })
})
