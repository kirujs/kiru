import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { RadioGroup } from "../radio-group.js"

describe("RadioGroup.Root - Default Rendering", () => {
  it("renders as div with role='radiogroup' by default", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('role="radiogroup"'))
  })

  it("renders with default vertical orientation", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="vertical"'))
    assert.ok(html.includes('data-orientation="vertical"'))
  })
})

describe("RadioGroup.Root - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <RadioGroup.Root asChild>
          <div className="custom-radiogroup">
            <RadioGroup.Item value="option1">
              <RadioGroup.Indicator>•</RadioGroup.Indicator>
            </RadioGroup.Item>
          </div>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-radiogroup"'))
    assert.ok(html.includes('role="radiogroup"'))
    assert.ok(html.includes('aria-orientation="vertical"'))
  })

  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <RadioGroup.Root asChild orientation="horizontal">
          <section className="my-group">
            <RadioGroup.Item value="option1">Option 1</RadioGroup.Item>
          </section>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="my-group"'))
    assert.ok(html.includes('role="radiogroup"'))
    assert.ok(html.includes('aria-orientation="horizontal"'))
  })
})

describe("RadioGroup.Root - Controlled Mode with Signal Prop", () => {
  it("uses controlled value signal", () => {
    const App = () => {
      const value = Kiru.signal("option2")
      return (
        <RadioGroup.Root value={value}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Count how many buttons have aria-checked="true" - should be 1
    const checkedButtons = html.match(/aria-checked="true"/g)
    assert.ok(checkedButtons, "should have checked button")
    assert.strictEqual(
      checkedButtons.length,
      1,
      "should have exactly one checked button"
    )
  })

  it("reflects controlled signal changes", () => {
    const App = () => {
      const value = Kiru.signal("option1")
      return (
        <RadioGroup.Root value={value}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Count how many buttons have aria-checked="true" - should be 1
    const checkedButtons = html.match(/aria-checked="true"/g)
    assert.ok(checkedButtons, "should have checked button")
    assert.strictEqual(
      checkedButtons.length,
      1,
      "should have exactly one checked button"
    )
  })
})

describe("RadioGroup.Root - Uncontrolled Mode with defaultValue", () => {
  it("uses defaultValue for initial state", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Count how many buttons have aria-checked="true" - should be 1
    const checkedButtons = html.match(/aria-checked="true"/g)
    assert.ok(checkedButtons, "should have checked button")
    assert.strictEqual(
      checkedButtons.length,
      1,
      "should have exactly one checked button"
    )
  })

  it("defaults to no selection when no defaultValue provided", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Both options should be unchecked
    const checkedMatches = html.match(/aria-checked="true"/g)
    assert.ok(!checkedMatches, "no options should be checked")
  })
})

describe("RadioGroup.Root - Orientation Prop", () => {
  it("supports horizontal orientation", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="horizontal">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="horizontal"'))
    assert.ok(html.includes('data-orientation="horizontal"'))
  })

  it("supports vertical orientation", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="vertical">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="vertical"'))
    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("defaults to vertical when orientation not specified", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="vertical"'))
    assert.ok(html.includes('data-orientation="vertical"'))
  })
})

describe("RadioGroup.Root - ARIA Attributes", () => {
  it("sets role='radiogroup'", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="radiogroup"'))
  })

  it("sets aria-orientation to horizontal", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="horizontal">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="horizontal"'))
  })

  it("sets aria-orientation to vertical", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="vertical">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-orientation="vertical"'))
  })
})

describe("RadioGroup.Root - Data Attributes", () => {
  it("sets data-orientation to horizontal", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="horizontal">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="horizontal"'))
  })

  it("sets data-orientation to vertical", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="vertical">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })
})

describe("RadioGroup.Root - Additional Props", () => {
  it("supports disabled prop as boolean", () => {
    const App = () => {
      return (
        <RadioGroup.Root disabled>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // The component should render without errors
    assert.ok(html.includes('role="radiogroup"'))
  })

  it("supports disabled prop as signal", () => {
    const App = () => {
      const disabled = Kiru.signal(true)
      return (
        <RadioGroup.Root disabled={disabled}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // The component should render without errors
    assert.ok(html.includes('role="radiogroup"'))
  })

  it("supports required prop as signal", () => {
    const App = () => {
      const required = Kiru.signal(true)
      return (
        <RadioGroup.Root required={required}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // The component should render without errors
    assert.ok(html.includes('role="radiogroup"'))
  })

  it("supports name prop for form integration", () => {
    const App = () => {
      return (
        <RadioGroup.Root name="choice">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // name is applied to hidden input elements
    assert.ok(html.includes('name="choice"'))
  })

  it("supports custom className", () => {
    const App = () => {
      return (
        <RadioGroup.Root className="my-radiogroup">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-radiogroup"'))
  })
})

describe("RadioGroup.Root - Display Name", () => {
  it("has displayName set to 'RadioGroupRoot'", () => {
    assert.strictEqual(RadioGroup.Root.displayName, "RadioGroupRoot")
  })
})

describe("RadioGroup.Item - Default Rendering", () => {
  it("renders as button with role='radio' by default", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<button"))
    assert.ok(html.includes('role="radio"'))
    assert.ok(html.includes('type="button"'))
  })

  it("renders with default unchecked state", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })
})

describe("RadioGroup.Item - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" asChild>
            <div className="custom-radio">Custom</div>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-radio"'))
    assert.ok(html.includes('role="radio"'))
    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes(">Custom</div>"))
  })

  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1" asChild>
            <button className="my-button">Select me</button>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-button"'))
    assert.ok(html.includes('role="radio"'))
    assert.ok(html.includes('aria-checked="true"'))
  })
})

describe("RadioGroup.Item - Selected State Rendering", () => {
  it("renders as checked when value matches group value", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Count how many buttons have aria-checked="true" - should be 1
    const checkedButtons = html.match(/aria-checked="true"/g)
    assert.ok(checkedButtons, "should have checked button")
    assert.strictEqual(
      checkedButtons.length,
      1,
      "should have exactly one checked button"
    )
  })

  it("renders as unchecked when value does not match group value", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("reflects controlled signal changes", () => {
    const App = () => {
      const value = Kiru.signal("option1")
      return (
        <RadioGroup.Root value={value}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Count how many buttons have aria-checked="true" - should be 1
    const checkedButtons = html.match(/aria-checked="true"/g)
    assert.ok(checkedButtons, "should have checked button")
    assert.strictEqual(
      checkedButtons.length,
      1,
      "should have exactly one checked button"
    )
  })
})

describe("RadioGroup.Item - Disabled State Rendering", () => {
  it("renders disabled state with aria-disabled='true'", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("sets aria-disabled='false' when not disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled={false}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
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
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled={disabled}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("inherits disabled state from group", () => {
    const App = () => {
      return (
        <RadioGroup.Root disabled>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("item disabled overrides group enabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root disabled={false}>
          <RadioGroup.Item value="option1" disabled={true}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })
})

describe("RadioGroup.Item - ARIA Attributes", () => {
  it("sets role='radio'", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="radio"'))
  })

  it("sets aria-checked='true' when selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="true"'))
  })

  it("sets aria-checked='false' when not selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-checked="false"'))
  })

  it("sets aria-disabled='true' when disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled={true}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
  })

  it("sets aria-disabled='false' when not disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="false"'))
  })
})

describe("RadioGroup.Item - Data Attributes", () => {
  it("sets data-state='checked' when selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="checked"'))
  })

  it("sets data-state='unchecked' when not selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="unchecked"'))
  })

  it("sets data-disabled when disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled={true}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })

  it("does not set data-disabled when not disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" disabled={false}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes("data-disabled"))
  })

  it("sets data-orientation from group context", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="horizontal">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="horizontal"'))
  })

  it("inherits vertical orientation from group", () => {
    const App = () => {
      return (
        <RadioGroup.Root orientation="vertical">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })
})

describe("RadioGroup.Item - Error When Used Outside Context", () => {
  it("throws error when used outside RadioGroup.Root", () => {
    const App = () => {
      return (
        <RadioGroup.Item value="option1">
          <RadioGroup.Indicator>•</RadioGroup.Indicator>
        </RadioGroup.Item>
      )
    }

    assert.throws(
      () => {
        renderToString(<App />)
      },
      (error: Error) => {
        // The error occurs when trying to destructure from null context
        return (
          error.message.includes("Cannot destructure") ||
          error.message.includes("RadioGroupRootContext") ||
          error.message.includes("null")
        )
      }
    )
  })
})

describe("RadioGroup.Item - Additional Props", () => {
  it("supports value prop as signal", () => {
    const App = () => {
      const itemValue = Kiru.signal("option1")
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value={itemValue}>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="radio"'))
    assert.ok(html.includes('aria-checked="true"'))
  })

  it("supports custom className", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1" className="my-radio">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-radio"'))
  })

  it("renders hidden input when group has name prop", () => {
    const App = () => {
      return (
        <RadioGroup.Root name="choice">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Hidden input should be present
    assert.ok(html.includes("<input"))
    assert.ok(html.includes('type="radio"'))
    assert.ok(html.includes('name="choice"'))
    assert.ok(html.includes('value="option1"'))
  })

  it("does not render hidden input when group has no name prop", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Should not have a hidden input
    assert.ok(!html.includes("<input"))
  })
})

describe("RadioGroup.Item - Display Name", () => {
  it("has displayName set to 'RadioGroupItem'", () => {
    assert.strictEqual(RadioGroup.Item.displayName, "RadioGroupItem")
  })
})

describe("RadioGroup.Indicator - Default Rendering", () => {
  it("renders as span by default", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
    assert.ok(html.includes(">•</span>"))
  })
})

describe("RadioGroup.Indicator - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator asChild>
              <div className="custom-indicator">✓</div>
            </RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-indicator"'))
    assert.ok(html.includes(">✓</div>"))
  })

  it("merges props with child element when using asChild", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator asChild>
              <span className="my-indicator">Selected</span>
            </RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="my-indicator"'))
    assert.ok(html.includes(">Selected</span>"))
  })
})

describe("RadioGroup.Indicator - Visibility When Item is Selected", () => {
  it("renders children when item is selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes(">•<"))
  })

  it("renders children when controlled signal matches item value", () => {
    const App = () => {
      const value = Kiru.signal("option2")
      return (
        <RadioGroup.Root value={value}>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>First</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>Second</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes(">Second<"))
  })
})

describe("RadioGroup.Indicator - Visibility When Item is Not Selected", () => {
  it("does not render children when item is not selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
          <RadioGroup.Item value="option2">
            <RadioGroup.Indicator>✓</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // The first indicator should not render its children
    assert.ok(!html.includes(">•<"))
    // The second indicator should render its children
    assert.ok(html.includes(">✓<"))
  })

  it("does not render children when no item is selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // The indicator should not render its children
    assert.ok(!html.includes(">•<"))
  })
})

describe("RadioGroup.Indicator - Attribute Inheritance from Item Context", () => {
  it("inherits data-state='checked' when item is selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it has data-state="checked"
    const indicatorMatch = html.match(
      /<span[^>]*data-state="checked"[^>]*>•<\/span>/
    )
    assert.ok(indicatorMatch, "indicator should have data-state='checked'")
  })

  it("inherits data-state='unchecked' when item is not selected", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option2">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it has data-state="unchecked"
    const indicatorMatch = html.match(/<span[^>]*data-state="unchecked"[^>]*>/)
    assert.ok(indicatorMatch, "indicator should have data-state='unchecked'")
  })

  it("inherits data-disabled when item is disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1" disabled>
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it has data-disabled
    const indicatorMatch = html.match(
      /<span[^>]*data-disabled=""[^>]*>•<\/span>/
    )
    assert.ok(indicatorMatch, "indicator should have data-disabled attribute")
  })

  it("does not have data-disabled when item is not disabled", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it does not have data-disabled
    const indicatorMatch = html.match(/<span[^>]*>•<\/span>/)
    assert.ok(indicatorMatch, "indicator should exist")
    assert.ok(
      !indicatorMatch[0].includes("data-disabled"),
      "indicator should not have data-disabled attribute"
    )
  })

  it("inherits data-orientation from group context", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1" orientation="horizontal">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it has data-orientation="horizontal"
    const indicatorMatch = html.match(
      /<span[^>]*data-orientation="horizontal"[^>]*>•<\/span>/
    )
    assert.ok(
      indicatorMatch,
      "indicator should have data-orientation='horizontal'"
    )
  })

  it("inherits vertical orientation from group context", () => {
    const App = () => {
      return (
        <RadioGroup.Root defaultValue="option1" orientation="vertical">
          <RadioGroup.Item value="option1">
            <RadioGroup.Indicator>•</RadioGroup.Indicator>
          </RadioGroup.Item>
        </RadioGroup.Root>
      )
    }
    const html = renderToString(<App />)

    // Find the indicator span and check it has data-orientation="vertical"
    const indicatorMatch = html.match(
      /<span[^>]*data-orientation="vertical"[^>]*>•<\/span>/
    )
    assert.ok(
      indicatorMatch,
      "indicator should have data-orientation='vertical'"
    )
  })
})

describe("RadioGroup.Indicator - Error When Used Outside Context", () => {
  it("throws error when used outside RadioGroup.Item", () => {
    const App = () => {
      return <RadioGroup.Indicator>•</RadioGroup.Indicator>
    }

    assert.throws(
      () => {
        renderToString(<App />)
      },
      (error: Error) => {
        // The error occurs when trying to destructure from null context
        return (
          error.message.includes("Cannot destructure") ||
          error.message.includes("RadioGroupItemContext") ||
          error.message.includes("null")
        )
      }
    )
  })

  it("throws error when used outside RadioGroup.Root but inside a different context", () => {
    const App = () => {
      return (
        <RadioGroup.Root>
          <RadioGroup.Indicator>•</RadioGroup.Indicator>
        </RadioGroup.Root>
      )
    }

    assert.throws(
      () => {
        renderToString(<App />)
      },
      (error: Error) => {
        // The error occurs when trying to destructure from null context
        return (
          error.message.includes("Cannot destructure") ||
          error.message.includes("RadioGroupItemContext") ||
          error.message.includes("null")
        )
      }
    )
  })
})

describe("RadioGroup.Indicator - Display Name", () => {
  it("has displayName set to 'RadioGroupIndicator'", () => {
    assert.strictEqual(RadioGroup.Indicator.displayName, "RadioGroupIndicator")
  })
})
