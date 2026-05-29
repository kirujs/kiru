describe("navigation signals", () => {
  const port = () => Cypress.expose("port")

  beforeEach(() => {
    cy.visit(`http://localhost:${port()}/navigation`)
  })

  it("exposes isNavigating and currentNavigation during slow navigation", () => {
    cy.get('[data-testid="nav-slow"]').click()
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(true)
        expect(nav?.to).to.include("/slow-target")
        expect(nav?.from).to.include("/navigation")
      })
    cy.get('[data-testid="slow-target"]').should("exist")
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(false)
        expect(nav?.from).to.eq("")
        expect(nav?.to).to.eq("")
      })
  })

  it("clears currentNavigation after programmatic navigate completes", () => {
    cy.get('[data-testid="nav-programmatic"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(false)
        expect(nav?.from).to.eq("")
        expect(nav?.to).to.eq("")
      })
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
    cy.get('[data-testid="slow-target"]').should("exist")
    cy.window()
      .its("__KIRU_NAV__")
      .should((nav) => {
        expect(nav?.isNavigating).to.eq(false)
      })
  })
})
