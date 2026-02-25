import { describe, it } from "node:test"
import assert from "node:assert"
import { renderToString } from "../../renderToString.js"
import * as kiru from "../../index.js"

describe("renderToString", () => {
  it("produces HTML with styles formatted correctly", () => {
    const App = () => {
      return (
        <div style="display:flex;">
          <h1 style={{ color: "red" }}>Hello world</h1>
        </div>
      )
    }
    const expected = `<div style="display:flex;"><h1 style="color:red;">Hello world</h1></div>`
    const res = renderToString(<App />)

    assert.strictEqual(res, expected)
  })
  it("is able to derive Context correctly", () => {
    const MyContext = kiru.createContext("test")
    const App = () => {
      return (
        <div>
          <MyContext.Provider value="test123">
            <ChildComponent />
          </MyContext.Provider>
        </div>
      )
    }
    const ChildComponent = () => {
      const ctx = kiru.useContext(MyContext)
      return <h1>{ctx}</h1>
    }
    const expected = `<div><h1>test123</h1></div>`
    const res = renderToString(<App />)
    assert.strictEqual(res, expected)
  })
  it("is able to use Signals for text content", () => {
    const text = kiru.signal("Hello world!")
    const App = () => {
      return (
        <div>
          <h1>{text}</h1>
        </div>
      )
    }
    const expected = `<div><h1>Hello world!</h1></div>`
    const res = renderToString(<App />)

    assert.strictEqual(res, expected)
  })
  it("is able to use Signals for DOM attributes", () => {
    const className = kiru.signal("main-header")
    const App = () => {
      return (
        <div>
          <h1 className={className}>Hello world!</h1>
        </div>
      )
    }
    const expected = `<div><h1 class="main-header">Hello world!</h1></div>`
    const res = renderToString(<App />)

    assert.strictEqual(res, expected)
  })
  it("does not render null, boolean or undefined values", () => {
    const App = () => {
      return (
        <div>
          <h1>Hello world!</h1>
          <NullComponent />
          <UndefinedComponent />
          <BooleanComponent />
        </div>
      )
    }
    const NullComponent = () => null
    const UndefinedComponent = () => undefined
    const BooleanComponent = () => true
    const expected = `<div><h1>Hello world!</h1></div>`
    const res = renderToString(<App />)

    assert.strictEqual(res, expected)
  })
  it("correctly renders boolean attributes", () => {
    const checked = kiru.signal(true)
    const App = () => {
      return (
        <div>
          <input type="checkbox" checked={checked} disabled={false} />
        </div>
      )
    }
    const expected = `<div><input type="checkbox" checked></div>`
    const res = renderToString(<App />)

    assert.strictEqual(res, expected)
  })
})
