describe("navigation signals", () => {
  const port = () => Cypress.env("port")

  beforeEach(() => {
    cy.visit(`http://localhost:${port()}/navigation`)
  })

  it("exposes isNavigating and currentNavigation during slow navigation", () => {
    cy.get('[data-testid="nav-slow"]').click()
    cy.get('[data-testid="nav-in-progress"]', { timeout: 2000 }).should(
      "contain",
      "yes"
    )
    cy.get('[data-testid="nav-to"]').should("contain", "/slow-target")
    cy.get('[data-testid="nav-from"]').should("contain", "/navigation")
    cy.get('[data-testid="slow-target"]', { timeout: 10000 }).should("exist")
    cy.get('[data-testid="nav-in-progress"]').should("contain", "no")
    cy.get('[data-testid="nav-to"]').should("have.text", "")
  })

  it("clears currentNavigation after programmatic navigate completes", () => {
    cy.get('[data-testid="nav-programmatic"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="nav-in-progress"]').should("contain", "no")
    cy.get('[data-testid="nav-from"]').should("have.text", "")
    cy.get('[data-testid="nav-to"]').should("have.text", "")
  })

  it("records navigation probe on window during transition", () => {
    cy.get('[data-testid="nav-slow"]').click()
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(true)
        expect(nav?.to).to.include("/slow-target")
        expect(nav?.from).to.include("/navigation")
      })
    cy.get('[data-testid="slow-target"]', { timeout: 10000 }).should("exist")
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(false)
      })
  })
})
