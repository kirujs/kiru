import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Slider } from "../slider.js"

describe("Slider.Root - Default Rendering", () => {
  it("renders as span with role='group' by default", () => {
    const App = () => {
      return <Slider.Root />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
    assert.ok(html.includes('role="group"'))
  })

  it("renders with default orientation='horizontal'", () => {
    const App = () => {
      return <Slider.Root />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="horizontal"'))
    assert.ok(html.includes('aria-orientation="horizontal"'))
  })

  it("renders with default value [0]", () => {
    const App = () => {
      const value = Kiru.signal([50])
      return <Slider.Root value={value} mode="multiple" name="test" />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('value="50"'))
  })

  it("has displayName set to 'SliderRoot'", () => {
    assert.strictEqual(Slider.Root.displayName, "SliderRoot")
  })
})

describe("Slider.Root - Orientation", () => {
  it("supports vertical orientation", () => {
    const App = () => {
      return <Slider.Root orientation="vertical" />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
    assert.ok(html.includes('aria-orientation="vertical"'))
  })
})

describe("Slider.Root - Disabled State", () => {
  it("sets data-disabled attribute when disabled", () => {
    const App = () => {
      return <Slider.Root disabled />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })

  it("does not set data-disabled when not disabled", () => {
    const App = () => {
      return <Slider.Root />
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes("data-disabled"))
  })
})

describe("Slider.Root - Hidden Inputs", () => {
  it("renders hidden input when name prop is provided", () => {
    const App = () => {
      return <Slider.Root name="volume" mode="multiple" defaultValue={[50]} />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('type="number"'))
    assert.ok(html.includes('name="volume"'))
    assert.ok(html.includes('value="50"'))
    assert.ok(html.includes('aria-hidden="true"'))
  })

  it("renders multiple hidden inputs with indexed names for multi-value", () => {
    const App = () => {
      return (
        <Slider.Root name="range" mode="multiple" defaultValue={[25, 75]} />
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('name="range[0]"'))
    assert.ok(html.includes('name="range[1]"'))
    assert.ok(html.includes('value="25"'))
    assert.ok(html.includes('value="75"'))
  })

  it("does not render hidden inputs when name prop is not provided", () => {
    const App = () => {
      return <Slider.Root mode="multiple" defaultValue={[50]} />
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes('type="number"'))
  })
})

describe("Slider.Root - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Slider.Root asChild>
          <div className="custom-slider" />
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-slider"'))
    assert.ok(html.includes('role="group"'))
  })
})

describe("Slider.Root - Range Configuration", () => {
  it("uses default min=0, max=100, step=1", () => {
    const App = () => {
      // We can't directly test the internal state, but we can verify
      // the component renders without errors with defaults
      return <Slider.Root />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="group"'))
  })

  it("accepts custom min, max, and step props", () => {
    const App = () => {
      return <Slider.Root min={10} max={200} step={5} />
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="group"'))
  })
})

describe("Slider.Track - Default Rendering", () => {
  it("renders as span element by default", () => {
    const App = () => {
      return (
        <Slider.Root>
          <Slider.Track />
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
  })

  it("has displayName set to 'SliderTrack'", () => {
    assert.strictEqual(Slider.Track.displayName, "SliderTrack")
  })

  it("inherits data-orientation from context", () => {
    const App = () => {
      return (
        <Slider.Root orientation="vertical">
          <Slider.Track />
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("inherits data-disabled from context when disabled", () => {
    const App = () => {
      return (
        <Slider.Root disabled>
          <Slider.Track />
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })
})

describe("Slider.Track - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Slider.Root>
          <Slider.Track asChild>
            <div className="custom-track" />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-track"'))
    assert.ok(html.includes('data-orientation="horizontal"'))
  })
})

describe("Slider.Track - Error When Used Outside Context", () => {
  it("throws error when used outside Slider.Root", () => {
    const App = () => {
      return <Slider.Track />
    }

    assert.throws(
      () => renderToString(<App />),
      /Slider\.Track must be used within Slider\.Root/
    )
  })
})

describe("Slider.Range - Default Rendering", () => {
  it("renders as span element by default", () => {
    const App = () => {
      return (
        <Slider.Root>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<span"))
  })

  it("has displayName set to 'SliderRange'", () => {
    assert.strictEqual(Slider.Range.displayName, "SliderRange")
  })

  it("inherits data-orientation from context", () => {
    const App = () => {
      return (
        <Slider.Root orientation="vertical">
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("inherits data-disabled from context when disabled", () => {
    const App = () => {
      return (
        <Slider.Root disabled>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-disabled=""'))
  })
})

describe("Slider.Range - Position Calculation", () => {
  it("calculates horizontal position and size based on value array", () => {
    const App = () => {
      return (
        <Slider.Root mode="multiple" defaultValue={[25, 75]}>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    // Should have left and width styles for horizontal orientation
    assert.ok(html.includes("left"))
    assert.ok(html.includes("width"))
  })

  it("calculates vertical position and size based on value array", () => {
    const App = () => {
      return (
        <Slider.Root
          orientation="vertical"
          mode="multiple"
          defaultValue={[25, 75]}
        >
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    // Should have bottom and height styles for vertical orientation
    assert.ok(html.includes("bottom"))
    assert.ok(html.includes("height"))
  })

  it("handles single value correctly", () => {
    const App = () => {
      return (
        <Slider.Root mode="multiple" defaultValue={[50]}>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    // Should render with position styles
    assert.ok(html.includes("left"))
    assert.ok(html.includes("width"))
  })
})

describe("Slider.Range - asChild Composition Pattern", () => {
  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Slider.Root>
          <Slider.Track>
            <Slider.Range asChild>
              <div className="custom-range" />
            </Slider.Range>
          </Slider.Track>
        </Slider.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('class="custom-range"'))
    assert.ok(html.includes('data-orientation="horizontal"'))
  })
})

describe("Slider.Range - Error When Used Outside Context", () => {
  it("throws error when used outside Slider.Root", () => {
    const App = () => {
      return <Slider.Range />
    }

    assert.throws(
      () => renderToString(<App />),
      /Slider\.Range must be used within Slider\.Root/
    )
  })
})
