describe("router", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}`)
  })

  it("displays the correct title", () => {
    cy.get("head title").should("exist").should("have.text", "Home")
    cy.get('nav a[href="/about"]').click()
    cy.get("head title").should("exist").should("have.text", "About")
  })

  it("displays the correct route child element", () => {
    cy.get("main #router-outlet h2").should("exist").should("have.text", "Home")
  })

  it("reacts to a <Link /> click appropriately", () => {
    cy.get('nav a[href="/about"]').click()
    cy.get("main #router-outlet h2")
      .should("exist")
      .should("have.text", "About")
  })

  it("reacts to a history-api triggered navigation event", () => {
    cy.get('nav a[href="/about"]').click()
    cy.go("back")
    cy.get("main #router-outlet h2").should("exist").should("have.text", "Home")
  })
})
