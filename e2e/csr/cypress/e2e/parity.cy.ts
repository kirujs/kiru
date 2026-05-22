describe("client parity (CSR)", () => {
  const port = () => Cypress.env("port")

  it("shows middleware { error: 403 } on client navigation (not /login)", () => {
    cy.visit(`http://localhost:${port()}/`)
    cy.get('nav a[href="/forbidden"]').click()
    cy.location("pathname").should("eq", "/forbidden")
    cy.get('[data-testid="csr-error-page"]').should("contain", "Forbidden")
    cy.get('[data-testid="forbidden-page"]').should("not.exist")
  })

  it("preserves hash after hydration on hash-only route", () => {
    cy.visit(`http://localhost:${port()}/hash-section#section`)
    cy.get('[data-testid="hash-router"]').should("contain", "#section")
    cy.get("#section").should("exist")
  })

  it("clears isNavigating after client navigation completes", () => {
    cy.visit(`http://localhost:${port()}/navigation`)
    cy.get('[data-testid="nav-programmatic"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.window().its("__KIRU_NAV__").should("deep.include", {
      isNavigating: false,
    })
  })
})
