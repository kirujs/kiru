import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { CheckboxGroup } from "../checkbox-group.js"
import { Checkbox } from "../checkbox.js"

describe("Checkbox.Root - Parent Checkbox Toggle Behavior", () => {
  it("parent checkbox toggles from unchecked to checked (adds all allValues)", () => {
    const value = Kiru.signal<string[]>([])

    const html1 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html1.includes('aria-checked="false"'))

    value.value = ["a", "b", "c"]

    const html2 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html2.includes('aria-checked="true"'))
  })

  it("parent checkbox toggles from checked to unchecked (removes all allValues)", () => {
    const value = Kiru.signal<string[]>(["a", "b", "c"])

    const html1 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html1.includes('aria-checked="true"'))

    value.value = []

    const html2 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html2.includes('aria-checked="false"'))
  })

  it("parent checkbox toggles from indeterminate to checked (adds remaining allValues)", () => {
    const value = Kiru.signal<string[]>(["a"])

    const html1 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html1.includes('aria-checked="mixed"'))

    value.value = ["a", "b", "c"]

    const html2 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html2.includes('aria-checked="true"'))
  })

  it("parent checkbox with empty allValues remains unchecked", () => {
    const value = Kiru.signal<string[]>([])

    const html = renderToString(
      <CheckboxGroup value={value} allValues={[]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("parent checkbox only affects values in allValues", () => {
    const value = Kiru.signal<string[]>(["x", "y"])

    const html1 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html1.includes('aria-checked="false"'))

    value.value = ["x", "y", "a", "b", "c"]

    const html2 = renderToString(
      <CheckboxGroup value={value} allValues={["a", "b", "c"]}>
        <Checkbox.Root parent>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      </CheckboxGroup>
    )
    assert.ok(html2.includes('aria-checked="true"'))
  })
})
