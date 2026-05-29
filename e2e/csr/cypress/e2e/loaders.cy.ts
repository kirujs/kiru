describe("route loaders (CSR)", () => {
  const port = () => Cypress.expose("port")

  it("runs clientLoader on direct visit", () => {
    cy.visit(`http://localhost:${port()}/loaders/client`)
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "client:from clientLoader"
    )
  })

  it("runs universal loader on client navigation", () => {
    cy.visit(`http://localhost:${port()}/`)
    cy.visit(`http://localhost:${port()}/loaders/universal`)
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "universal:from loader"
    )
  })

  it("runs clientLoader when navigating via Link", () => {
    cy.visit(`http://localhost:${port()}/`)
    cy.get('nav a[href="/loaders/client"]').click()
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "client:from clientLoader"
    )
  })
})
