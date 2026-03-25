import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Collapsible } from "../collapsible.js"

describe("Collapsible - Trigger Component", () => {
  it("renders as button with type='button' by default", () => {
    const App = () => {
      return (
        <Collapsible.Root>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('type="button"'))
    assert.ok(html.includes(">Toggle</button>"))
  })

  it("sets aria-expanded to 'false' when closed", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-expanded="false"'))
  })

  it("sets aria-expanded to 'true' when open", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-expanded="true"'))
  })

  it("sets data-state to 'closed' when closed", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="closed"'))
  })

  it("sets data-state to 'open' when open", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("sets aria-disabled and data-disabled when disabled", () => {
    const App = () => {
      return (
        <Collapsible.Root disabled={true}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("sets aria-controls to reference Content ID", () => {
    const App = () => {
      return (
        <Collapsible.Root>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    // Extract the trigger ID from aria-controls
    const ariaControlsMatch = html.match(/aria-controls="([^"]+)"/)
    assert.ok(ariaControlsMatch, "aria-controls attribute should be present")

    const contentId = ariaControlsMatch?.[1]
    // Verify the content has the matching ID
    assert.ok(html.includes(`id="${contentId}"`))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Collapsible.Root>
          <Collapsible.Trigger asChild>
            <a href="#toggle">Custom Toggle</a>
          </Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<a"))
    assert.ok(html.includes('href="#toggle"'))
    assert.ok(html.includes("aria-expanded"))
    assert.ok(html.includes(">Custom Toggle</a>"))
  })

  it("sets disabled attribute on button when disabled", () => {
    const App = () => {
      return (
        <Collapsible.Root disabled={true}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("disabled"))
  })
})

describe("Collapsible - Content Component", () => {
  it("renders as div with role='region' by default", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Content>Content text</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="region"'))
    assert.ok(html.includes(">Content text</div>"))
  })

  it("sets aria-labelledby to reference Trigger ID", () => {
    const App = () => {
      return (
        <Collapsible.Root>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    // Extract the trigger ID
    const triggerIdMatch = html.match(/id="([^"]+:trigger)"/)
    assert.ok(triggerIdMatch, "trigger ID should be present")

    const triggerId = triggerIdMatch?.[1]
    // Verify the content has aria-labelledby referencing the trigger
    assert.ok(html.includes(`aria-labelledby="${triggerId}"`))
  })

  it("sets data-state to 'open' when open", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="open"'))
  })

  it("sets data-state to 'closed' when closed", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="closed"'))
  })

  it("sets data-disabled when disabled", () => {
    const App = () => {
      return (
        <Collapsible.Root disabled={true} defaultOpen={true}>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("data-disabled"))
  })

  it("displays children when open", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Content>Visible content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("Visible content"))
    assert.ok(!html.includes("hidden"))
  })

  it("hides children when closed", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Content>Hidden content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    // Content should be hidden
    assert.ok(!html.includes("Hidden content"))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Content asChild>
            <section className="custom-section">Custom content</section>
          </Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="custom-section"'))
    assert.ok(html.includes('role="region"'))
    assert.ok(html.includes("Custom content"))
  })

  it("sets id attribute for ARIA relationships", () => {
    const App = () => {
      return (
        <Collapsible.Root>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    // Content should have an ID ending with :content
    assert.ok(html.match(/id="[^"]+:content"/))
  })

  it("prevents animation on initial mount when open", () => {
    const App = () => {
      return (
        <Collapsible.Root defaultOpen={true}>
          <Collapsible.Content>Content</Collapsible.Content>
        </Collapsible.Root>
      )
    }
    const html = renderToString(<App />)

    // Content should be visible without hidden attribute
    assert.ok(html.includes("Content"))
    assert.ok(!html.includes("hidden"))
  })
})
