import { describe, it } from "node:test"
import assert from "node:assert"
import * as Kiru from "kiru"
import { renderToString } from "kiru"
import { Tabs } from "../tabs.js"

describe("Tabs - Root Component", () => {
  it("renders as div with data-orientation by default", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<div"))
    assert.ok(html.includes('data-orientation="horizontal"'))
  })

  it("sets data-orientation to vertical when specified", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1" orientation="vertical">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1" asChild>
          <section className="custom-tabs">
            <Tabs.List>
              <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
            </Tabs.List>
          </section>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="custom-tabs"'))
    assert.ok(html.includes("data-orientation"))
  })
})

describe("Tabs - List Component", () => {
  it("renders as div with role='tablist' by default", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="tablist"'))
    assert.ok(html.includes("<div"))
  })

  it("inherits data-orientation from Root", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1" orientation="vertical">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const listMatch = html.match(/<div[^>]*role="tablist"[^>]*>/)
    assert.ok(listMatch)
    assert.ok(listMatch[0].includes('data-orientation="vertical"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List asChild>
            <nav className="custom-list">
              <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
            </nav>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<nav"))
    assert.ok(html.includes('class="custom-list"'))
    assert.ok(html.includes('role="tablist"'))
  })
})

describe("Tabs - Trigger Component", () => {
  it("renders as button with type='button' by default", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('type="button"'))
    assert.ok(html.includes(">Tab 1</button>"))
  })

  it("sets role='tab' on trigger", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="tab"'))
  })

  it("sets aria-selected to 'true' when active", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-selected="true"'))
  })

  it("sets aria-selected to 'false' when inactive", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-2">Tab 2</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-selected="false"'))
  })

  it("sets data-state to 'active' when active", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="active"'))
  })

  it("sets data-state to 'inactive' when inactive", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-2">Tab 2</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="inactive"'))
  })

  it("sets aria-disabled and data-disabled when disabled", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1" disabled={true}>
              Tab 1
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('aria-disabled="true"'))
    assert.ok(html.includes("data-disabled"))
  })

  it("sets disabled attribute on button when disabled", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1" disabled={true}>
              Tab 1
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("disabled"))
  })

  it("sets aria-controls to reference Content ID", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const ariaControlsMatch = html.match(/aria-controls="([^"]+)"/)
    assert.ok(ariaControlsMatch, "aria-controls attribute should be present")

    const contentId = ariaControlsMatch?.[1]
    assert.ok(html.includes(`id="${contentId}"`))
  })

  it("sets tabIndex to 0 for active tab", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const triggerMatch = html.match(/<button[^>]*aria-selected="true"[^>]*>/)
    assert.ok(triggerMatch)
    assert.ok(triggerMatch[0].includes('tabindex="0"'))
  })

  it("sets tabIndex to -1 for inactive tab", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-2">Tab 2</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const triggerMatch = html.match(/<button[^>]*aria-selected="false"[^>]*>/)
    assert.ok(triggerMatch)
    assert.ok(triggerMatch[0].includes('tabindex="-1"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1" asChild>
              <a href="#tab1">Custom Tab</a>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<a"))
    assert.ok(html.includes('href="#tab1"'))
    assert.ok(html.includes('role="tab"'))
    assert.ok(html.includes(">Custom Tab</a>"))
  })
})

describe("Tabs - Content Component", () => {
  it("renders as div with role='tabpanel' by default", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1">Content text</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('role="tabpanel"'))
    assert.ok(html.includes(">Content text</div>"))
  })

  it("sets aria-labelledby to reference Trigger ID", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.List>
            <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const triggerIdMatch = html.match(/id="([^"]+:trigger:[^"]+)"/)
    assert.ok(triggerIdMatch, "trigger ID should be present")

    const triggerId = triggerIdMatch?.[1]
    assert.ok(html.includes(`aria-labelledby="${triggerId}"`))
  })

  it("sets data-state to 'active' when active", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="active"'))
  })

  it("sets data-state to 'inactive' when inactive", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-2">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-state="inactive"'))
  })

  it("inherits data-orientation from Root", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1" orientation="vertical">
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes('data-orientation="vertical"'))
  })

  it("displays children when active", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1">Visible content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("Visible content"))
    assert.ok(!html.includes("hidden"))
  })

  it("hides children when inactive", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-2">Hidden content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(!html.includes("Hidden content"))
  })

  it("sets tabIndex to 0 for active content", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const contentMatch = html.match(/<div[^>]*data-state="active"[^>]*>/)
    assert.ok(contentMatch)
    assert.ok(contentMatch[0].includes('tabindex="0"'))
  })

  it("sets tabIndex to -1 for inactive content", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-2">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    const contentMatch = html.match(/<div[^>]*data-state="inactive"[^>]*>/)
    assert.ok(contentMatch)
    assert.ok(contentMatch[0].includes('tabindex="-1"'))
  })

  it("supports asChild composition pattern", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1" asChild>
            <section className="custom-content">Custom content</section>
          </Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.includes("<section"))
    assert.ok(html.includes('class="custom-content"'))
    assert.ok(html.includes('role="tabpanel"'))
    assert.ok(html.includes("Custom content"))
  })

  it("sets id attribute for ARIA relationships", () => {
    const App = () => {
      return (
        <Tabs.Root defaultValue="tab-1">
          <Tabs.Content value="tab-1">Content</Tabs.Content>
        </Tabs.Root>
      )
    }
    const html = renderToString(<App />)

    assert.ok(html.match(/id="[^"]+:content:[^"]+"/))
  })
})
