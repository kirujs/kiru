describe("SSG build", () => {
  it("serves prerendered HTML with route meta and hydrates", () => {
    cy.visit("/")
    cy.title().should("eq", "E2E SSG Home")
    cy.get('[data-testid="ssg-home"]').should("contain", "SSG e2e home")
    cy.get('[data-testid="ssg-layout"]').should("exist")
  })

  it("serves prerendered static routes", () => {
    cy.visit("/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })

  it("supports browser history between prerendered routes", () => {
    cy.visit("/")
    cy.visit("/about")
    cy.location("pathname").should("eq", "/about")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.go("forward")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })
})
