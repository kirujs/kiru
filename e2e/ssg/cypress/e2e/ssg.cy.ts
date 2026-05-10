describe("SSG build", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}`

  it("serves prerendered HTML with route meta and hydrates", () => {
    cy.visit(base())
    cy.title().should("eq", "E2E SSG Home")
    cy.get('[data-testid="ssg-home"]').should("contain", "SSG e2e home")
    cy.get('[data-testid="ssg-layout"]').should("exist")
  })

  it("serves prerendered static routes", () => {
    cy.visit(`${base()}/about`)
    cy.get('[data-testid="ssg-about"]').should("exist")
  })

  it("includes dynamic route params in prerendered post pages", () => {
    cy.visit(`${base()}/posts/one`)
    cy.get('[data-testid="ssg-post"]').should("contain", "one")
    cy.get('[data-testid="ssg-loader"]').should("contain", "post:one")
  })

  it("serves static 404.html for unknown paths", () => {
    cy.request({
      url: `${base()}/does-not-exist`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(404)
      expect(res.body).to.include("ssg-not-found")
    })
  })

  it("supports browser history between prerendered routes", () => {
    cy.visit(base())
    cy.visit(`${base()}/about`)
    cy.location("pathname").should("eq", "/about")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.go("forward")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })
})
