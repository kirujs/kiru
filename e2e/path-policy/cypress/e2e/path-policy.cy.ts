describe("path policy (CSR, baseUrl /app)", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}/app`

  it("renders home under non-root base URL", () => {
    cy.visit(`${base()}/`)
    cy.location("pathname").should("eq", "/app/")
    cy.get('[data-testid="pp-home"]').should("have.text", "Home under /app")
  })

  it("navigates with Link while staying under /app prefix", () => {
    cy.visit(`${base()}/`)
    cy.window().its("__kiruHydratedAt").then((t0) => {
      cy.get('[data-testid="nav-about"]').click()
      cy.window().its("__kiruHydratedAt").should("eq", t0)
    })
    cy.location("pathname").should("eq", "/app/about")
    cy.get('[data-testid="pp-about"]').should("have.text", "About under /app")
  })

  it("resolves Link href without trailing slash (never policy)", () => {
    cy.visit(`${base()}/`)
    cy.get('[data-testid="nav-about"]').should("have.attr", "href", "/app/about")
  })
})
