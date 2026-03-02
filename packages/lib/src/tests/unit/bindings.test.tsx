import { describe, it } from "node:test"
import assert from "node:assert"
import * as kiru from "../../index.js"
import { setSignalProp } from "../../dom/props.js"

class FakeRangeInput {
  nodeType = 1
  nodeName = "INPUT"
  type = "range"
  min = ""
  max = ""
  private _value = ""
  style = {
    setProperty() {},
    removeProperty() {},
  }

  get value() {
    return this._value
  }

  set value(v: string) {
    const num = Number(v)
    const min = this.min === "" ? -Infinity : Number(this.min)
    const max = this.max === "" ? Infinity : Number(this.max)
    if (Number.isNaN(num)) {
      this._value = v
      return
    }
    const clamped = Math.min(max, Math.max(min, num))
    this._value = String(clamped)
  }

  get valueAsNumber() {
    const n = Number(this._value)
    return Number.isNaN(n) ? undefined : n
  }

  addEventListener() {}
  removeEventListener() {}

  setAttribute(name: string, value: any) {
    if (name === "min") this.min = String(value)
    if (name === "max") this.max = String(value)
  }
}

describe("DOM bindings (CSR-like behavior)", () => {
  it("clamps bind:value for range inputs and syncs back to the signal", () => {
    const n = kiru.signal(50)
    const input = new FakeRangeInput()
    input.max = "5"

    const vNode: any = { cleanups: {} }

    setSignalProp(vNode, input as any, "bind:value", n, undefined)

    assert.strictEqual(input.value, "5")
    assert.strictEqual(n.peek(), 5)
  })

  it("reconciles multiple bound range inputs with different constraints", () => {
    const n = kiru.signal(50)

    const input1 = new FakeRangeInput()
    input1.max = "5"
    setSignalProp({ cleanups: {} } as any, input1 as any, "bind:value", n, undefined)
    assert.strictEqual(n.peek(), 5)

    const input2 = new FakeRangeInput()
    input2.min = "69"
    setSignalProp({ cleanups: {} } as any, input2 as any, "bind:value", n, undefined)
    assert.strictEqual(n.peek(), 69)
  })
})


