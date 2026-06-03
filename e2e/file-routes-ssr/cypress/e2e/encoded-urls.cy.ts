describe("encoded URLs (SSR file-routes)", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}`

  it("decodes encoded dynamic segment on full load", () => {
    cy.visit(`${base()}/blog/hello%20world`)
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello world")
  })

  it("matches catch-all segment with slashes on full load", () => {
    cy.visit(`${base()}/docs/a/b/c`)
    cy.get('[data-testid="fbr-docs"]').should("contain", "a/b/c")
  })

  it("preserves repeated query keys on full load", () => {
    cy.visit(`${base()}/?a=1&a=2`)
    cy.location("search").should("eq", "?a=1&a=2")
  })
})
