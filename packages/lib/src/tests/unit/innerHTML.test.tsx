import { describe, it } from "node:test"
import assert from "node:assert"
import { renderToString } from "../../renderToString.js"
import * as kiru from "../../index.js"

describe("innerHTML", () => {
  it("sets the inner content of the tag", () => {
    const App = () => {
      return <div innerHTML="Hello world!"></div>
    }
    const expected = `<div>Hello world!</div>`
    const res = renderToString(<App />)
    assert.strictEqual(res, expected)
  })
  it("can use a Signal to set the inner content of the tag", () => {
    const text = kiru.signal("Hello world!")
    const App = () => {
      return <div innerHTML={text}></div>
    }
    const expected = `<div>Hello world!</div>`
    const res = renderToString(<App />)
    assert.strictEqual(res, expected)
  })
  it("enforces that no children should be provided if specified", () => {
    const App = () => {
      return (
        <div innerHTML="Hello world!">
          <h1>Hello world</h1>
        </div>
      )
    }

    assert.throws(() => {
      renderToString(<App />)
    })
  })
})
