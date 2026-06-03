describe("file-based routes (SSR)", () => {
  const base = () => `http://127.0.0.1:${Cypress.env("port")}`

  it("FR-01 renders home on full page load", () => {
    cy.visit(base())
    cy.get('[data-testid="fbr-home"]').should("have.text", "Home")
  })

  it("FR-02 navigates to about with Link after hydrate", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-about"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("have.text", "About")
  })

  it("FR-03 applies co-located middleware redirect on full page load", () => {
    cy.visit(`${base()}/guarded`)
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("exist")
    cy.get('[data-testid="fbr-guarded"]').should("not.exist")
  })

  it("FR-03 applies co-located middleware redirect on client navigation", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-guarded"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("exist")
    cy.get('[data-testid="fbr-guarded"]').should("not.exist")
  })

  it("FR-04 matches dynamic [slug] on full page load", () => {
    cy.visit(`${base()}/blog/hello`)
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("FR-04 navigates to dynamic [slug] via Link after hydrate", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-blog"]').click()
    cy.location("pathname").should("eq", "/blog/hello")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("FR-05 serves route group without group segment on full page load", () => {
    cy.visit(`${base()}/pricing`)
    cy.location("pathname").should("eq", "/pricing")
    cy.get('[data-testid="fbr-pricing"]').should("have.text", "Pricing")
  })

  it("FR-05 navigates to route group via Link after hydrate", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-pricing"]').click()
    cy.location("pathname").should("eq", "/pricing")
    cy.get('[data-testid="fbr-pricing"]').should("have.text", "Pricing")
  })

  it("FR-06 serves hand-written route from routes.extend.ts via Link", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-manual"]').click()
    cy.location("pathname").should("eq", "/manual")
    cy.get('[data-testid="fbr-manual"]').should("have.text", "Manual (extend)")
  })

  it("FR-06 serves hand-written route on full page load", () => {
    cy.visit(`${base()}/manual`)
    cy.location("pathname").should("eq", "/manual")
    cy.get('[data-testid="fbr-manual"]').should("have.text", "Manual (extend)")
  })

  it("FR-07 renders not-found UI for unknown paths", () => {
    cy.visit(`${base()}/does-not-exist`, { failOnStatusCode: false })
    cy.get('[data-testid="fbr-not-found"]').should("contain", "Not Found")
  })

  // SSR scoped notFound returns HTTP 404 (see router unit tests).
  it("FR-07 returns 404 for unknown paths", () => {
    cy.request({ url: `${base()}/does-not-exist`, failOnStatusCode: false }).then(
      (res) => {
        expect(res.status).to.eq(404)
        expect(res.body).to.include("Not Found")
      }
    )
  })

  it("FR-08 applies page.config head title on full page load", () => {
    cy.visit(`${base()}/about`)
    cy.title().should("eq", "About — file routes")
  })

  it("FR-08 applies page.config head title after client navigation", () => {
    cy.visit(base())
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="nav-about"]').click()
    cy.title().should("eq", "About — file routes")
    cy.get('[data-testid="kiru-route-announcer"]').should(
      "have.text",
      "About — file routes"
    )
  })
})
