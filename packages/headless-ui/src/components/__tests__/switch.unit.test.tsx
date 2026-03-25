import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Switch } from "../switch.js"

describe("Switch.Root - Default Rendering", () => {
  it("renders as button with role='switch' by default", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<button"))
    assert.ok(html.includes('role="switch"'))
    assert.ok(html.includes('type="button"'))
  })

  it("renders with default unchecked state", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("has displayName set to 'SwitchRoot'", () => {
    assert.strictEqual(Switch.Root.displayName, "SwitchRoot")
  })
})

describe("Switch.Thumb - Default Rendering", () => {
  it("renders as span element by default", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb>Toggle</Switch.Thumb>
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
    assert.ok(html.includes(">Toggle</span>"))
  })

  it("inherits data-state from context", () => {
    const App = () => {
      return (
        <Switch.Root defaultChecked>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    // Both Root and Thumb should have data-state
    const stateMatches = html.match(/data-state="checked"/g)
    assert.ok(stateMatches && stateMatches.length >= 2)
  })

  it("has displayName set to 'SwitchThumb'", () => {
    assert.strictEqual(Switch.Thumb.displayName, "SwitchThumb")
  })
})

describe("Switch.Root - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Switch.Root asChild>
          <div className="custom-switch">Custom</div>
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-switch"'))
    assert.ok(html.includes('role="switch"'))
    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes(">Custom</div>"))
  })

  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <Switch.Root asChild disabled>
          <button className="my-button">Toggle me</button>
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-button"'))
    assert.ok(html.includes('role="switch"'))
    assert.ok(html.includes('aria-disabled="true"'))
  })
})

describe("Switch.Thumb - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb asChild>
            <div className="custom-thumb">Thumb</div>
          </Switch.Thumb>
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-thumb"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Switch.Root - Controlled Mode", () => {
  it("uses controlled checked signal value", () => {
    const App = () => {
      const checked = Kiru.signal(true)
      return (
        <Switch.Root checked={checked}>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="true"'))
    assert.ok(html.includes('data-state="checked"'))
  })

  it("reflects controlled signal changes", () => {
    const App = () => {
      const checked = Kiru.signal(false)
      return (
        <Switch.Root checked={checked}>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Switch.Root - Uncontrolled Mode", () => {
  it("uses defaultChecked prop for initial state", () => {
    const App = () => {
      return (
        <Switch.Root defaultChecked>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="true"'))
    assert.ok(html.includes('data-state="checked"'))
  })

  it("defaults to unchecked when no defaultChecked provided", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Switch.Root - Disabled State", () => {
  it("sets aria-disabled='true' when disabled", () => {
    const App = () => {
      return (
        <Switch.Root disabled>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
  })

  it("sets data-disabled attribute when disabled", () => {
    const App = () => {
      return (
        <Switch.Root disabled>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })

  it("sets disabled attribute on button element when disabled", () => {
    const App = () => {
      return (
        <Switch.Root disabled>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("disabled"))
  })

  it("Thumb inherits data-disabled from context", () => {
    const App = () => {
      return (
        <Switch.Root disabled>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    // Both Root and Thumb should have data-disabled
    const disabledMatches = html.match(/data-disabled=""/g)
    assert.ok(disabledMatches && disabledMatches.length >= 2)
  })
})

describe("Switch.Root - Form Integration", () => {
  it("renders hidden checkbox input when name prop is provided", () => {
    const App = () => {
      return (
        <Switch.Root name="notifications">
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('type="checkbox"'))
    assert.ok(html.includes('name="notifications"'))
    assert.ok(html.includes('aria-hidden="true"'))
  })

  it("hidden input has default value 'on' when no value prop provided", () => {
    const App = () => {
      return (
        <Switch.Root name="toggle">
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('value="on"'))
  })

  it("hidden input uses custom value when value prop provided", () => {
    const App = () => {
      return (
        <Switch.Root name="toggle" value="yes">
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('value="yes"'))
  })

  it("hidden input is visually hidden but present in DOM", () => {
    const App = () => {
      return (
        <Switch.Root name="toggle">
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("position:absolute"))
    assert.ok(html.includes("opacity:0"))
  })

  it("does not render hidden input when name prop is not provided", () => {
    const App = () => {
      return (
        <Switch.Root>
          <Switch.Thumb />
        </Switch.Root>
      )
    }
    const html = renderToString(<App />)

    // Should only have one button, no input
    const inputMatches = html.match(/<input/g)
    assert.ok(!inputMatches)
  })
})
