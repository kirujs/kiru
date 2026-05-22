describe("file-based routes (SSG)", () => {
  it("prerenders home from pages/page.tsx", () => {
    cy.visit("/")
    cy.get('[data-testid="fbr-home"]').should("have.text", "Home")
  })

  it("prerenders dynamic [slug] route", () => {
    cy.visit("/blog/hello")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("renders not-found for unknown paths", () => {
    cy.request({ url: "/does-not-exist", failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(404)
      expect(res.body).to.include("Not Found")
    })
  })

  it("navigates with Link after hydrate", () => {
    cy.visit("/")
    cy.get('[data-testid="nav-about"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("have.text", "About")
  })
})
