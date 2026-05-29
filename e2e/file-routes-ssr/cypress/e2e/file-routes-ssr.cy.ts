describe("file-based routes (SSR)", () => {
  const base = () => `http://127.0.0.1:${Cypress.expose("port")}`

  it("renders home on full page load", () => {
    cy.visit(base())
    cy.get('[data-testid="fbr-home"]').should("have.text", "Home")
  })

  it("applies co-located middleware redirect on full page load", () => {
    cy.visit(`${base()}/guarded`)
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("exist")
  })

  it("matches dynamic [slug] on full page load", () => {
    cy.visit(`${base()}/blog/hello`)
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("navigates with Link after hydrate", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-about"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("have.text", "About")
  })
})
