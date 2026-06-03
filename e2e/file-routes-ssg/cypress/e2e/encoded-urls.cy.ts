describe("encoded URLs (SSG file-routes)", () => {
  it("decodes encoded dynamic segment on full load", () => {
    cy.visit("/blog/hello%20world")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello world")
  })

  it("matches catch-all segment with slashes on full load", () => {
    cy.visit("/docs/a/b/c")
    cy.get('[data-testid="fbr-docs"]').should("contain", "a/b/c")
  })

  it("preserves repeated query keys on full load", () => {
    cy.visit("/?a=1&a=2")
    cy.location("search").should("eq", "?a=1&a=2")
  })
})
