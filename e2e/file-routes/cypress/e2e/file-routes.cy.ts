describe("file-based routes", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}`

  beforeEach(() => {
    cy.visit(base())
  })

  it("renders home from pages/page.tsx", () => {
    cy.get('[data-testid="fbr-home"]').should("have.text", "Home")
  })

  it("navigates to about", () => {
    cy.get('[data-testid="nav-about"]').click()
    cy.get('[data-testid="fbr-about"]').should("have.text", "About")
  })

  it("applies co-located middleware redirect", () => {
    cy.get('[data-testid="nav-guarded"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("exist")
    cy.get('[data-testid="fbr-guarded"]').should("not.exist")
  })

  it("matches dynamic [slug] segment", () => {
    cy.get('[data-testid="nav-blog"]').click()
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("serves route group without group segment in URL", () => {
    cy.visit(`${base()}/pricing`)
    cy.location("pathname").should("eq", "/pricing")
    cy.get('[data-testid="fbr-pricing"]').should("have.text", "Pricing")
  })

  it("serves hand-written route from routes.extend.ts", () => {
    cy.get('[data-testid="nav-manual"]').click()
    cy.location("pathname").should("eq", "/manual")
    cy.get('[data-testid="fbr-manual"]').should("have.text", "Manual (extend)")
  })

  it("renders not-found for unknown paths", () => {
    cy.visit(`${base()}/does-not-exist`)
    cy.get('[data-testid="fbr-not-found"]').should("contain", "Not Found")
  })
})
