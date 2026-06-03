describe("encoded URLs (CSR file-routes)", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}`

  it("decodes encoded dynamic segment on full load", () => {
    cy.visit(`${base()}/blog/hello%20world`)
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello world")
  })

  it("navigates to encoded dynamic segment via Link", () => {
    cy.visit(base())
    cy.get('[data-testid="nav-blog"]').click()
    cy.location("pathname").should("eq", "/blog/hello")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("matches catch-all segment with slashes", () => {
    cy.visit(`${base()}/docs/a/b/c`)
    cy.get('[data-testid="fbr-docs"]').should("contain", "a/b/c")
  })

  it("preserves repeated query keys in the location bar", () => {
    cy.visit(`${base()}/?a=1&a=2`)
    cy.location("search").should("eq", "?a=1&a=2")
  })
})
