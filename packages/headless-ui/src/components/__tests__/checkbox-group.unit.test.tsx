import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { CheckboxGroup } from "../checkbox-group.js"
import { Checkbox } from "../checkbox.js"

describe("CheckboxGroup.Root - Default Rendering", () => {
  it("renders as div with role='group' by default", () => {
    const App = () => {
      return (
        <CheckboxGroup.Root>
          <div />
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('role="group"'))
  })
})

describe("CheckboxGroup.Root - asChild Composition Pattern", () => {
  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <CheckboxGroup.Root asChild name="choices" defaultValue={["a"]}>
          <section className="my-checkbox-group" />
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="my-checkbox-group"'))
    assert.ok(html.includes('role="group"'))
    assert.ok(html.includes('name="choices"'))
  })
})

describe("CheckboxGroup.Root - Checkbox Integration", () => {
  it("reflects group value in child checkbox aria/data attributes", () => {
    const value = Kiru.signal<string[]>(["a"])

    const App = () => {
      return (
        <CheckboxGroup.Root value={value}>
          <Checkbox.Root value="a">
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
          <Checkbox.Root value="b">
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)

    const checkedStates = html.match(/aria-checked="true"/g) ?? []
    assert.strictEqual(checkedStates.length, 1)
    assert.ok(html.includes('data-state="checked"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("CheckboxGroup.Root - Parent Checkbox State", () => {
  it("renders unchecked when none of allValues are selected", () => {
    const value = Kiru.signal<string[]>([])

    const App = () => {
      return (
        <CheckboxGroup.Root value={value} allValues={["a", "b", "c"]}>
          <Checkbox.Root parent>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("renders indeterminate when some of allValues are selected", () => {
    const value = Kiru.signal<string[]>(["a", "b"])

    const App = () => {
      return (
        <CheckboxGroup.Root value={value} allValues={["a", "b", "c"]}>
          <Checkbox.Root parent>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('aria-checked="mixed"'))
    assert.ok(html.includes('data-state="indeterminate"'))
  })

  it("renders checked when all of allValues are selected", () => {
    const value = Kiru.signal<string[]>(["a", "b", "c"])

    const App = () => {
      return (
        <CheckboxGroup.Root value={value} allValues={["a", "b", "c"]}>
          <Checkbox.Root parent>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        </CheckboxGroup.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('aria-checked="true"'))
    assert.ok(html.includes('data-state="checked"'))
  })
})
