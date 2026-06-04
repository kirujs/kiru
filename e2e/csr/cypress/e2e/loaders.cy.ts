describe("route loaders (CSR)", () => {
  const port = () => Cypress.env("port")

  it("runs clientLoader on direct visit", () => {
    cy.visit(`http://localhost:${port()}/loaders/client`)
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "client:from clientLoader"
    )
  })

  it("runs universal loader on client navigation without full reload", () => {
    cy.visit(`http://localhost:${port()}/`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get("#app").invoke("attr", "data-kiru-hydrated-at").then((t0) => {
      cy.get('nav a[href="/loaders/universal"]').click()
      cy.get("#app").invoke("attr", "data-kiru-hydrated-at").should("eq", t0)
    })
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "universal:from loader"
    )
  })

  it("runs clientLoader when navigating via Link", () => {
    cy.visit(`http://localhost:${port()}/`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('nav a[href="/loaders/client"]').click()
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "client:from clientLoader"
    )
  })
})
