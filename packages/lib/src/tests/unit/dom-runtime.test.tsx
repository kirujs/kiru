import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "./jsdom.js"

const waitForMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("DOM runtime (Node + jsdom)", () => {
  it("mounts, updates, handles events, and unmounts", async () => {
    await withJSDOM(async (container, kiru) => {
      const app = kiru.mount(<div id="first">hello</div>, container)

      const initialDiv = container.querySelector("#first")
      assert.ok(initialDiv, "mount should render into the container")

      let clickCount = 0
      app.render(<button onclick={() => clickCount++}>click me</button>)

      const button = container.querySelector("button")
      assert.ok(button, "render should update the existing app tree")
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
      assert.strictEqual(clickCount, 1, "event handlers should run in jsdom")

      app.unmount()
      await waitForMicrotask()
      assert.strictEqual(
        container.innerHTML,
        "",
        "unmount should clear DOM output"
      )
    })
  })

  it("reorders keyed children while preserving existing DOM nodes", async () => {
    await withJSDOM(async (container, kiru) => {
      const KeyedList = ({ ids }: { ids: string[] }) => (
        <ul>
          {ids.map((id) => (
            <li key={id} data-id={id}>
              {id}
            </li>
          ))}
        </ul>
      )

      const app = kiru.mount(
        <KeyedList ids={["a", "b", "c", "d"]} />,
        container
      )

      const initialNodes = new Map(
        Array.from(container.querySelectorAll("li")).map((el) => [
          el.getAttribute("data-id"),
          el,
        ])
      )

      app.render(<KeyedList ids={["d", "b", "a", "c"]} />)

      const reordered = Array.from(container.querySelectorAll("li"))
      assert.deepStrictEqual(
        reordered.map((el) => el.getAttribute("data-id")),
        ["d", "b", "a", "c"],
        "keyed render should update DOM order"
      )
      assert.ok(initialNodes.get("d"), "initial keyed node should exist")
      assert.ok(initialNodes.get("a"), "initial keyed node should exist")
    })
  })

  it("updates fragment-style array children correctly", async () => {
    await withJSDOM(async (container, kiru) => {
      const app = kiru.mount(
        <>
          <span data-id="first">one</span>
          <span key="second" data-id="second">
            two
          </span>
          <span key="third" data-id="third">
            three
          </span>
        </>,
        container
      )

      assert.strictEqual(
        container.textContent?.replace(/\s+/g, ""),
        "onetwothree",
        "initial nested array children should render"
      )

      app.render(
        <>
          <span key="second" data-id="second">
            two+
          </span>
          <span key="third" data-id="third">
            three
          </span>
        </>
      )

      const spans = Array.from(container.querySelectorAll("span"))
      assert.deepStrictEqual(
        spans.map((el) => el.getAttribute("data-id")),
        ["second", "third"],
        "array child updates should reflect inserted/removed keyed nodes"
      )
      assert.strictEqual(
        container.textContent?.replace(/\s+/g, ""),
        "two+three",
        "text and array children should reconcile in final output"
      )

      app.unmount()
      await waitForMicrotask()
    })
  })

  it("supports bind:value in the DOM-first runtime", async () => {
    await withJSDOM(async (container, kiru) => {
      const count = kiru.signal<any>(10)
      const app = kiru.mount(
        <input type="range" bind:value={count} min={0} max={5} />,
        container
      )

      const input = container.querySelector("input") as HTMLInputElement | null
      assert.ok(input, "input should render")
      assert.strictEqual(
        input.value,
        "5",
        "initial signal value should be clamped after ordered prop application"
      )
      assert.strictEqual(
        count.value,
        5,
        "signal should reconcile with clamped DOM value"
      )

      count.value = 3
      assert.strictEqual(input.value, "3", "signal updates should write to input")

      input.value = "4"
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
      assert.strictEqual(count.value, 4, "input events should write back to signal")

      app.unmount()
      await waitForMicrotask()
    })
  })

  it("removes stale event handlers when event prop becomes non-function", async () => {
    await withJSDOM(async (container, kiru) => {
      let clicks = 0
      const app = kiru.mount(<button onclick={() => clicks++}>Tap</button>, container)
      const button = container.querySelector("button") as HTMLButtonElement
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
      assert.strictEqual(clicks, 1, "initial event listener should fire")

      app.render(<button onclick={undefined}>Tap</button>)
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
      assert.strictEqual(
        clicks,
        1,
        "stale listener should be removed when event prop is no longer a function"
      )
    })
  })

  it("keeps style object signal bindings reactive", async () => {
    await withJSDOM(async (container, kiru) => {
      const width = kiru.signal("10px")
      const app = kiru.mount(<div style={{ width }} />, container)
      const div = container.querySelector("div") as HTMLDivElement
      assert.strictEqual(div.style.width, "10px", "initial style signal should apply")

      width.value = "25px"
      assert.strictEqual(div.style.width, "25px", "style should update from signal")

      app.render(<div style={{}} />)
      width.value = "50px"
      assert.strictEqual(
        div.style.width,
        "",
        "style signal subscription should be removed after style key removal"
      )
    })
  })

  it("updates inline function children on reconciliation", async () => {
    await withJSDOM(async (container, kiru) => {
      const app = kiru.mount(<div>{() => 2 * 5}</div>, container)
      const text = () => container.textContent?.replace(/\s+/g, "")

      assert.strictEqual(text(), "10", "initial inline function value should render")
      app.render(<div>{() => 3 * 5}</div>)
      assert.strictEqual(
        text(),
        "15",
        "reconciliation should update inline function child output"
      )

      app.unmount()
      await waitForMicrotask()
    })
  })

  it("sets and clears object refs across mount/update/unmount", async () => {
    await withJSDOM(async (container, kiru) => {
      const firstRef = kiru.ref<Element | null>(null)
      const secondRef = kiru.ref<Element | null>(null)

      const app = kiru.mount(<div id="one" ref={firstRef} />, container)
      assert.ok(firstRef.current, "ref should be set on initial mount")
      assert.strictEqual(
        (firstRef.current as Element).id,
        "one",
        "ref should point to the mounted element"
      )

      app.render(<div id="one" ref={secondRef} />)
      assert.strictEqual(
        firstRef.current,
        null,
        "previous ref should be cleared when ref prop changes"
      )
      assert.ok(secondRef.current, "next ref should be assigned on update")

      app.unmount()
      await waitForMicrotask()
      assert.strictEqual(
        secondRef.current,
        null,
        "ref should be cleared when element unmounts"
      )
    })
  })

  it("supports callback refs in DOM-first runtime", async () => {
    await withJSDOM(async (container, kiru) => {
      const calls: Array<Element | null> = []
      const capture = (el: Element | null) => calls.push(el)
      const app = kiru.mount(<button ref={capture}>ok</button>, container)
      assert.ok(
        calls.at(-1) instanceof window.Element,
        "callback ref should receive mounted element"
      )

      app.unmount()
      await waitForMicrotask()
      assert.strictEqual(
        calls.at(-1),
        null,
        "callback ref should receive null on unmount"
      )
    })
  })

  it("creates SVG elements with the SVG namespace", async () => {
    await withJSDOM(async (container, kiru) => {
      kiru.mount(
        <svg>
          <g>
            <circle cx="5" cy="5" r="3" />
          </g>
        </svg>,
        container
      )

      const svg = container.querySelector("svg")
      const g = container.querySelector("g")
      const circle = container.querySelector("circle")

      assert.ok(svg && g && circle, "svg subtree should render")
      assert.strictEqual(
        svg.namespaceURI,
        "http://www.w3.org/2000/svg",
        "svg root should use SVG namespace"
      )
      assert.strictEqual(
        g.namespaceURI,
        "http://www.w3.org/2000/svg",
        "nested svg element should use SVG namespace"
      )
      assert.strictEqual(
        circle.namespaceURI,
        "http://www.w3.org/2000/svg",
        "leaf svg element should use SVG namespace"
      )
    })
  })

  it("runs onMount after ref assignment for mounted host nodes", async () => {
    await withJSDOM(async (container, kiru) => {
      const seen = kiru.ref<HTMLElement | null>(null)
      let mountedRef: HTMLElement | null = null
      let mountedCalled = false

      const Example: Kiru.FC = () => {
        kiru.onMount(() => {
          mountedCalled = true
          mountedRef = seen.current
        })
        return () => <div ref={seen}>ready</div>
      }

      kiru.mount(<Example />, container)
      await waitForMicrotask()
      assert.ok(mountedCalled, "onMount should fire for mounted component")
      assert.ok(mountedRef, "onMount should observe assigned ref")
      assert.strictEqual(
        (mountedRef as HTMLElement).textContent,
        "ready",
        "ref should point to mounted host element"
      )
    })
  })

  it("runs component cleanups before clearing host refs", async () => {
    await withJSDOM(async (container, kiru) => {
      const seen = kiru.ref<HTMLElement | null>(null)
      let cleanupSawRef = false

      const Example: Kiru.FC = () => {
        kiru.onCleanup(() => {
          cleanupSawRef = !!seen.current
        })
        return () => <div ref={seen}>bye</div>
      }

      const app = kiru.mount(<Example />, container)
      app.unmount()
      await waitForMicrotask()
      assert.ok(
        cleanupSawRef,
        "onCleanup should run before host ref is nulled during unmount"
      )
      assert.strictEqual(
        seen.current,
        null,
        "host ref should be nulled after cleanup runs"
      )
    })
  })

  it("keeps sibling host event handlers isolated inside one component", async () => {
    await withJSDOM(async (container, kiru) => {
      let left = 0
      let right = 0

      const Pair: Kiru.FC<{ rightEnabled: boolean }> = ({ rightEnabled }) => (
        <div>
          <button id="left" onclick={() => left++}>
            left
          </button>
          <button id="right" onclick={rightEnabled ? () => right++ : undefined}>
            right
          </button>
        </div>
      )

      const app = kiru.mount(<Pair rightEnabled={true} />, container)
      let leftBtn = container.querySelector("#left") as HTMLButtonElement
      let rightBtn = container.querySelector("#right") as HTMLButtonElement
      leftBtn.click()
      rightBtn.click()
      assert.strictEqual(left, 1, "left handler should fire")
      assert.strictEqual(right, 1, "right handler should fire")

      app.render(<Pair rightEnabled={false} />)
      leftBtn = container.querySelector("#left") as HTMLButtonElement
      rightBtn = container.querySelector("#right") as HTMLButtonElement
      leftBtn.click()
      rightBtn.click()
      assert.strictEqual(left, 2, "left handler should still fire after update")
      assert.strictEqual(right, 1, "right handler should be removed independently")
    })
  })

})
