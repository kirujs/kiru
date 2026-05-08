describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("hydrates SSR context and enforces navigation guards", () => {
    cy.title().should("eq", "E2E SSR Home")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.get('[data-testid="ssr-user"]').should("contain", "E2E User")
    cy.get('[data-testid="ssr-layout"]').should("exist")

    cy.contains("a", "Guarded").click()
    cy.location("pathname").should("eq", "/guarded")
    cy.contains("This page should be redirected away.").should("exist")

    cy.contains("a", "Home").click()
    cy.location("pathname").should("eq", "/")

    cy.contains("a", "Blocked (leave-guarded)").click()
    cy.location("pathname").should((pathname) => {
      expect(["/", "/blocked"]).to.include(pathname)
    })
  })

  it("handles standard route navigation and dynamic params", () => {
    cy.contains("a", "About").click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssr-layout"]').should("exist")

    cy.contains("a", "User 99").click()
    cy.location("pathname").should("eq", "/users/99")
  })

  it("restores route content on browser back/forward", () => {
    cy.contains("a", "About").click()
    cy.location("pathname").should("eq", "/about")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="ssr-layout"]').should("exist")
    cy.go("forward")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssr-layout"]').should("exist")
  })

  it("executes remote functions through server action endpoint", () => {
    cy.get('[data-testid="ssr-remote-button"]').click()
    cy.get('[data-testid="ssr-remote-result"]').should(
      "contain",
      "hello from server (E2E User)"
    )
  })

  it("renders scoped notFound route for unknown paths", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/missing-ssr-route`, {
      failOnStatusCode: false,
    })
    cy.get('[data-testid="ssr-not-found"]').should("contain", "SSR not found")
  })
})
