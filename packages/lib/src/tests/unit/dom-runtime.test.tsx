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

})
