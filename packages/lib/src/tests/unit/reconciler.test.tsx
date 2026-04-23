import { describe, it } from "node:test"
import assert from "node:assert"
import { withJSDOM } from "./jsdom.js"

describe("reconciler (DOM-first)", () => {
  it("reorders keyed list items without recreating DOM nodes", async () => {
    await withJSDOM(async (container, kiru) => {
      const ids = kiru.signal(["a", "b", "c", "d"])
      const Keyed = ({ values }: { values: string[] }) => (
        <ul>{values.map((id) => <li key={id}>{id}</li>)}</ul>
      )
      const app = kiru.mount(
        <Keyed values={ids.value} />,
        container
      )

      const firstNodes = Array.from(container.querySelectorAll("li"))
      ids.value = ["d", "b", "a", "c"]
      app.render(<Keyed values={ids.value} />)

      const secondNodes = Array.from(container.querySelectorAll("li"))
      assert.deepStrictEqual(
        secondNodes.map((node) => node.textContent),
        ["d", "b", "a", "c"]
      )
      assert.strictEqual(secondNodes.length, firstNodes.length)
      app.unmount()
    })
  })

  it("reconciles nested fragment arrays with stable order", async () => {
    await withJSDOM(async (container, kiru) => {
      const showMiddle = kiru.signal(true)
      const FragmentList = ({ visible }: { visible: boolean }) => (
        <div>
          <span key="a">A</span>
          {visible ? [<span key="b">B</span>, <span key="c">C</span>] : null}
          <span key="d">D</span>
        </div>
      )
      const app = kiru.mount(<FragmentList visible={showMiddle.value} />, container)
      assert.strictEqual(container.textContent, "ABCD")
      showMiddle.value = false
      app.render(<FragmentList visible={showMiddle.value} />)
      assert.strictEqual(container.textContent, "AD")
      showMiddle.value = true
      app.render(<FragmentList visible={showMiddle.value} />)
      assert.strictEqual(container.textContent, "ABCD")
    })
  })
})
