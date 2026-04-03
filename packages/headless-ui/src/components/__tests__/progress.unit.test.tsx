import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Progress } from "../progress.js"

describe("Progress - Root + Indicator", () => {
  it("renders a progressbar indicator and defaults to loading", () => {
    const App = () => {
      return (
        <Progress.Root>
          <Progress.Indicator />
        </Progress.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('role="progressbar"'))
    assert.ok(html.includes('data-state="loading"'))
  })

  it("sets data-state to indeterminate for value=null", () => {
    const App = () => {
      return (
        <Progress.Root value={null} max={100}>
          <Progress.Indicator />
        </Progress.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('data-state="indeterminate"'))
    assert.ok(!html.includes('aria-valuenow="'))
  })

  it("sets data-state to complete when value>=max", () => {
    const App = () => {
      return (
        <Progress.Root value={100} max={100}>
          <Progress.Indicator />
        </Progress.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('data-state="complete"'))
  })

  it("sets aria-valuetext using getValueLabel", () => {
    const App = () => {
      return (
        <Progress.Root
          value={42}
          max={100}
          getValueLabel={(v) => `${v}%`}
        >
          <Progress.Indicator />
        </Progress.Root>
      )
    }

    const html = renderToString(<App />)
    assert.ok(html.includes('aria-valuetext="42%"'))
  })
})

