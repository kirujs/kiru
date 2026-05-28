describe("home page hydration proof", () => {
  it("hydrates / without hydration mismatches and with full home DOM", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/`, {
      onBeforeLoad(win) {
        ;(win as typeof win & { __e2eConsoleErrors?: string[] }).__e2eConsoleErrors =
          []
        const prevError = win.console.error.bind(win.console)
        win.console.error = (...args: unknown[]) => {
          ;(
            win as typeof win & { __e2eConsoleErrors?: string[] }
          ).__e2eConsoleErrors!.push(
            args
              .map((a) => {
                try {
                  return typeof a === "string" ? a : JSON.stringify(a)
                } catch {
                  return String(a)
                }
              })
              .join(" ")
          )
          prevError(...args)
        }
      },
    })

    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((win) => {
      const hydrationErrors = (win.__kiruHydrationErrors ?? []).map(String)
      expect(
        hydrationErrors,
        `unexpected hydration errors: ${hydrationErrors.join(" | ")}`
      ).to.deep.eq([])
      const consoleErrors = (
        win as typeof win & { __e2eConsoleErrors?: string[] }
      ).__e2eConsoleErrors ?? []
      const hydrationConsoleErrors = consoleErrors.filter((line) =>
        /hydration mismatch|no template shell element found|kiruerror/i.test(line)
      )
      expect(
        hydrationConsoleErrors,
        `unexpected hydration console errors: ${hydrationConsoleErrors.join(" | ")}`
      ).to.deep.eq([])
    })

    cy.document().then((doc) => {
      const html = doc.body.innerHTML
      expect(
        html,
        `home marker missing. html excerpt: ${html.slice(0, 500)}`
      ).to.include('data-testid="ssr-home"')
    })
    cy.get('[data-testid="ssr-home"]').should("have.text", "SSR e2e home")
    cy.get('[data-testid="ssr-user"]').should("contain", "User:")
    cy.get('[data-testid="ssr-remote-button"]').should("have.text", "Call remote")
    cy.get('[data-testid="ssr-remote-result"]').should("exist")
  })
})
