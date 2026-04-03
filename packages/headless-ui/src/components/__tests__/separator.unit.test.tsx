import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Separator } from "../separator.js"

describe("Separator - Default", () => {
  it("renders role='separator' and defaults to horizontal", () => {
    const App = () => {
      return <Separator />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="separator"'))
    assert.ok(html.includes('aria-orientation="horizontal"'))
    assert.ok(html.includes('data-orientation="horizontal"'))
  })
})

describe("Separator - Orientation", () => {
  it("supports vertical orientation", () => {
    const App = () => {
      return <Separator orientation="vertical" />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="vertical"'))
    assert.ok(html.includes('data-orientation="vertical"'))
  })
})

describe("Separator - asChild", () => {
  it("merges role/orientation attrs into the child element", () => {
    const App = () => {
      return (
        <Separator asChild orientation="vertical">
          <hr className="my-separator" />
        </Separator>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<hr"))
    assert.ok(html.includes('class="my-separator"'))
    assert.ok(html.includes('role="separator"'))
    assert.ok(html.includes('aria-orientation="vertical"'))
  })
})

