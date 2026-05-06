describe("SSG build", () => {
  it("serves prerendered HTML with route meta and hydrates", () => {
    cy.visit("/")
    cy.title().should("eq", "E2E SSG Home")
    cy.get('[data-testid="ssg-home"]').should("contain", "SSG e2e home")
    cy.get('[data-testid="ssg-layout"]').should("exist")
  })
})
