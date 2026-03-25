import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Accordion } from "../accordion.js"

describe("Accordion - Root Component", () => {
  it("renders as div with data-orientation by default", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("sets data-orientation to horizontal when specified", () => {
    const App = () => {
      return (
        <Accordion.Root orientation="horizontal">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="horizontal"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Accordion.Root asChild>
          <section className="custom-accordion">
            <Accordion.Item value="item-1">
              <Accordion.Trigger>Toggle</Accordion.Trigger>
            </Accordion.Item>
          </section>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="custom-accordion"'))
    assert.ok(html.includes("data-orientation"))
  })
})

describe("Accordion - Item Component", () => {
  it("renders as div with data-state by default", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("sets data-state to 'closed' when not active", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-2">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="closed"'))
  })

  it("sets data-disabled when disabled", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1" disabled={true}>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("data-disabled"))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1" asChild>
            <article className="custom-item">
              <Accordion.Trigger>Toggle</Accordion.Trigger>
            </article>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<article"))
    assert.ok(html.includes('class="custom-item"'))
    assert.ok(html.includes("data-state"))
  })
})

describe("Accordion - Header Component", () => {
  it("renders as h3 by default", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Header>Header Text</Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<h3"))
    assert.ok(html.includes(">Header Text</h3>"))
  })

  it("renders with custom heading level", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Header level={2}>Header Text</Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<h2"))
    assert.ok(html.includes(">Header Text</h2>"))
  })

  it("inherits data attributes from item", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Header>Header</Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Header asChild>
              <div className="custom-header">Header</div>
            </Accordion.Header>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('class="custom-header"'))
    assert.ok(html.includes("data-state"))
  })
})

describe("Accordion - Trigger Component", () => {
  it("renders as button with type='button' by default", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('type="button"'))
    assert.ok(html.includes(">Toggle</button>"))
  })

  it("sets aria-expanded to 'false' when closed", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-expanded="false"'))
  })

  it("sets aria-expanded to 'true' when open", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-expanded="true"'))
  })

  it("sets data-state to 'closed' when closed", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="closed"'))
  })

  it("sets data-state to 'open' when open", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("sets aria-disabled and data-disabled when disabled", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1" disabled={true}>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("sets aria-controls to reference Content ID", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    const ariaControlsMatch = html.match(/aria-controls="([^"]+)"/)
    assert.ok(ariaControlsMatch, "aria-controls attribute should be present")

    const contentId = ariaControlsMatch?.[1]
    assert.ok(html.includes(`id="${contentId}"`))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger asChild>
              <a href="#toggle">Custom Toggle</a>
            </Accordion.Trigger>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<a"))
    assert.ok(html.includes('href="#toggle"'))
    assert.ok(html.includes("aria-expanded"))
    assert.ok(html.includes(">Custom Toggle</a>"))
  })
})

describe("Accordion - Content Component", () => {
  it("renders as div with role='region' by default", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content text</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="region"'))
    assert.ok(html.includes(">Content text</div>"))
  })

  it("sets aria-labelledby to reference Trigger ID", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    const triggerIdMatch = html.match(/id="([^"]+:trigger:[^"]+)"/)
    assert.ok(triggerIdMatch, "trigger ID should be present")

    const triggerId = triggerIdMatch?.[1]
    assert.ok(html.includes(`aria-labelledby="${triggerId}"`))
  })

  it("sets data-state to 'open' when open", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("sets data-state to 'closed' when closed", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="closed"'))
  })

  it("sets data-disabled when item is disabled", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1" disabled={true}>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("data-disabled"))
  })

  it("displays children when open", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Visible content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("Visible content"))
    assert.ok(!html.includes("hidden"))
  })

  it("hides children when closed", () => {
    const App = () => {
      return (
        <Accordion.Root>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content>Hidden content</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes("Hidden content"))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Accordion.Root defaultValue="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle</Accordion.Trigger>
            <Accordion.Content asChild>
              <section className="custom-content">Custom content</section>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="custom-content"'))
    assert.ok(html.includes('role="region"'))
    assert.ok(html.includes("Custom content"))
  })
})

describe("Accordion - Multiple Mode", () => {
  it("allows multiple items to be open simultaneously", () => {
    const App = () => {
      return (
        <Accordion.Root mode="multiple" defaultValue={["item-1", "item-2"]}>
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Toggle 1</Accordion.Trigger>
            <Accordion.Content>Content 1</Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="item-2">
            <Accordion.Trigger>Toggle 2</Accordion.Trigger>
            <Accordion.Content>Content 2</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )
    }
    const html = renderToString(<App />)

    const expandedMatches = html.match(/aria-expanded="true"/g)
    assert.ok(expandedMatches && expandedMatches.length === 2)
    assert.ok(html.includes("Content 1"))
    assert.ok(html.includes("Content 2"))
  })
})
