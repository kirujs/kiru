import { describe, it } from "node:test"
import assert from "node:assert"
import {
  encodeStaticText,
  KIRU_HOLE_MARKER,
  serializeStaticElementToHtml,
} from "../../utils/staticHtml.js"

describe("staticHtml", () => {
  it("encodes quotes and slashes", () => {
    assert.strictEqual(encodeStaticText(`a'b/c`), "a&#039;b&#47;c")
  })

  it("serializes static span with className", () => {
    assert.strictEqual(
      serializeStaticElementToHtml("span", { className: "badge" }, "OK"),
      '<span class="badge">OK</span>'
    )
  })

  it("serializes void input", () => {
    assert.strictEqual(
      serializeStaticElementToHtml("input", { type: "number", disabled: true }),
      '<input type="number" disabled>'
    )
  })

  it("includes hole marker in inner html", () => {
    assert.strictEqual(
      serializeStaticElementToHtml("div", {}, `<span>A</span>${KIRU_HOLE_MARKER}`),
      `<div><span>A</span>${KIRU_HOLE_MARKER}</div>`
    )
  })
})
