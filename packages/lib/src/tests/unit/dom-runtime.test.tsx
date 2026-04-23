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
      assert.strictEqual(
        reordered[0],
        initialNodes.get("d"),
        "existing keyed nodes should be moved, not recreated"
      )
      assert.strictEqual(
        reordered[2],
        initialNodes.get("a"),
        "existing keyed nodes should preserve identity after reorder"
      )
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
})
