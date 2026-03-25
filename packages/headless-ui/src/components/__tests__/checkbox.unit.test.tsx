import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Checkbox } from "../checkbox.js"

describe("Checkbox.Root - Default Rendering", () => {
  it("renders as button with role='checkbox' by default", () => {
    const App = () => {
      return (
        <Checkbox.Root>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<button"))
    assert.ok(html.includes('role="checkbox"'))
    assert.ok(html.includes('type="button"'))
  })

  it("renders with default unchecked state", () => {
    const App = () => {
      return (
        <Checkbox.Root>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Checkbox.Root - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Checkbox.Root asChild>
          <div className="custom-checkbox">Custom</div>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-checkbox"'))
    assert.ok(html.includes('role="checkbox"'))
    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes(">Custom</div>"))
  })

  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <Checkbox.Root asChild disabled>
          <button className="my-button">Check me</button>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-button"'))
    assert.ok(html.includes('role="checkbox"'))
    assert.ok(html.includes('aria-disabled="true"'))
  })
})

describe("Checkbox.Root - Controlled Mode", () => {
  it("uses controlled checked signal value", () => {
    const App = () => {
      const checked = Kiru.signal(true)
      return (
        <Checkbox.Root checked={checked}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
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
        <Checkbox.Root checked={checked}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Checkbox.Root - Uncontrolled Mode", () => {
  it("uses defaultChecked for initial state", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="true"'))
    assert.ok(html.includes('data-state="checked"'))
  })

  it("defaults to unchecked when no defaultChecked provided", () => {
    const App = () => {
      return (
        <Checkbox.Root>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("supports defaultChecked as false", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("Checkbox.Root - Indeterminate State", () => {
  it("renders indeterminate state with aria-checked='mixed'", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked="indeterminate">
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="mixed"'))
    assert.ok(html.includes('data-state="indeterminate"'))
  })

  it("supports controlled indeterminate state", () => {
    const App = () => {
      const checked = Kiru.signal<boolean | "indeterminate">("indeterminate")
      return (
        <Checkbox.Root checked={checked}>
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="mixed"'))
    assert.ok(html.includes('data-state="indeterminate"'))
  })
})

describe("Checkbox.Root - Disabled State", () => {
  it("renders disabled state with aria-disabled='true'", () => {
    const App = () => {
      return (
        <Checkbox.Root disabled>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("sets aria-disabled='false' when not disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root disabled={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="false"'))
    assert.ok(!html.includes("data-disabled"))
  })

  it("supports disabled as signal", () => {
    const App = () => {
      const disabled = Kiru.signal(true)
      return (
        <Checkbox.Root disabled={disabled}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })
})

describe("Checkbox.Root - ARIA Attributes", () => {
  it("sets aria-checked='true' when checked", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="true"'))
  })

  it("sets aria-checked='false' when unchecked", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
  })

  it("sets aria-checked='mixed' when indeterminate", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked="indeterminate">
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="mixed"'))
  })

  it("sets aria-disabled='true' when disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root disabled={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
  })

  it("sets aria-disabled='false' when not disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="false"'))
  })
})

describe("Checkbox.Root - Data Attributes", () => {
  it("sets data-state='checked' when checked", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="checked"'))
  })

  it("sets data-state='unchecked' when unchecked", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("sets data-state='indeterminate' when indeterminate", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked="indeterminate">
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="indeterminate"'))
  })

  it("sets data-disabled when disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root disabled={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })

  it("does not set data-disabled when not disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root disabled={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes("data-disabled"))
  })
})

describe("Checkbox.Root - Additional Props", () => {
  it("supports name and value props for hidden input", () => {
    const App = () => {
      return (
        <Checkbox.Root name="terms" value="accepted">
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    // name and value are applied to the hidden input element, not the button
    assert.ok(html.includes("<input"))
    assert.ok(html.includes('type="checkbox"'))
    assert.ok(html.includes('name="terms"'))
    assert.ok(html.includes('value="accepted"'))
  })

  it("supports required prop as signal", () => {
    const App = () => {
      const required = Kiru.signal(true)
      return (
        <Checkbox.Root required={required}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    // The component should render without errors
    assert.ok(html.includes('role="checkbox"'))
  })

  it("supports custom className", () => {
    const App = () => {
      return (
        <Checkbox.Root className="my-checkbox">
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-checkbox"'))
  })
})

describe("Checkbox.Root - Display Name", () => {
  it("has displayName set to 'CheckboxRoot'", () => {
    assert.strictEqual(Checkbox.Root.displayName, "CheckboxRoot")
  })
})

describe("Checkbox.Indicator - Default Rendering", () => {
  it("renders as span by default", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
    assert.ok(html.includes(">✓</span>"))
  })
})

describe("Checkbox.Indicator - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator asChild>
            <div className="custom-indicator">Check</div>
          </Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-indicator"'))
    assert.ok(html.includes(">Check</div>"))
  })

  it("merges data attributes with child element when using asChild", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator asChild>
            <span className="child-class">✓</span>
          </Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="child-class"'))
    assert.ok(html.includes('data-state="checked"'))
  })
})

describe("Checkbox.Indicator - Visibility Based on Checked State", () => {
  it("renders children when checked is true", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes(">✓</span>"))
  })

  it("does not render children when checked is false", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    // The span should exist but without children
    assert.ok(html.includes("<span"))
    assert.ok(!html.includes(">✓"))
  })

  it("renders children when checked is 'indeterminate'", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked="indeterminate">
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes(">-</span>"))
  })
})

describe("Checkbox.Indicator - Attribute Inheritance from Context", () => {
  it("inherits data-state='checked' when checked is true", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="checked"'))
  })

  it("inherits data-state='unchecked' when checked is false", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("inherits data-state='indeterminate' when checked is 'indeterminate'", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked="indeterminate">
          <Checkbox.Indicator>-</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="indeterminate"'))
  })

  it("inherits data-disabled when checkbox is disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true} disabled={true}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })

  it("does not have data-disabled when checkbox is not disabled", () => {
    const App = () => {
      return (
        <Checkbox.Root defaultChecked={true} disabled={false}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )
    }
    const html = renderToString(<App />)

    // Check that data-disabled is not present on the indicator
    const indicatorMatch = html.match(/<span[^>]*>✓<\/span>/)
    assert.ok(indicatorMatch)
    assert.ok(!indicatorMatch[0].includes("data-disabled"))
  })
})

describe("Checkbox.Indicator - Error When Used Outside Context", () => {
  it("throws error when used outside Checkbox.Root", () => {
    const App = () => {
      return <Checkbox.Indicator>✓</Checkbox.Indicator>
    }

    assert.throws(
      () => {
        renderToString(<App />)
      },
      (error: Error) => {
        // The error occurs when trying to destructure from null context
        return (
          error.message.includes("Cannot destructure") ||
          error.message.includes("CheckboxRootContext") ||
          error.message.includes("null")
        )
      }
    )
  })
})

describe("Checkbox.Indicator - Display Name", () => {
  it("has displayName set to 'CheckboxIndicator'", () => {
    assert.strictEqual(Checkbox.Indicator.displayName, "CheckboxIndicator")
  })
})
