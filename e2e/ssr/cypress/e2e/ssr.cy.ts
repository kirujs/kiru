describe("SSR server", () => {
  it("returns HTML with route meta and hydrates without error", () => {
    cy.visit("/")
    cy.title().should("eq", "E2E SSR Home")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.get('[data-testid="ssr-layout"]').should("exist")
  })
})
