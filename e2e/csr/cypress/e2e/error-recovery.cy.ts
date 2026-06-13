describe("CSR error recovery", () => {
  const port = () => Cypress.env("port")

  beforeEach(() => {
    cy.visit(`http://localhost:${port()}/`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
  })

  it("shows route error UI when page throws after client navigation", () => {
    cy.get('[data-testid="nav-csr-break"]').click()
    cy.location("pathname").should("eq", "/csr-break")
    cy.get('[data-testid="csr-error-page"]', { timeout: 10000 }).should(
      "contain",
      "CSR error boundary: e2e-csr-boom"
    )
    cy.get('[data-testid="nav-home"]').click()
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="csr-error-page"]').should("not.exist")
  })

  it("passes loader failure to the page via PageProps.error", () => {
    cy.get('[data-testid="nav-csr-break-loader"]').click()
    cy.location("pathname").should("eq", "/csr-break-loader")
    cy.get('[data-testid="csr-loader-error"]', { timeout: 10000 }).should(
      "contain",
      "Loader error: e2e-csr-loader-boom"
    )
    cy.get('[data-testid="csr-error-page"]').should("not.exist")
    cy.get('[data-testid="nav-home"]').click()
    cy.get('[data-testid="csr-loader-error"]').should("not.exist")
  })
})
