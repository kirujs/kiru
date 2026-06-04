describe("file-based routes (SSG)", () => {
  it("FR-01 prerenders home from pages/page.tsx", () => {
    cy.visit("/")
    cy.get('[data-testid="fbr-home"]').should("have.text", "Home")
  })

  it("FR-02 navigates to about with Link after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-about"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("have.text", "About")
  })

  // /guarded is static:false (middleware redirect) — not served on SSG preview full load; client nav covers FR-03.

  it("FR-03 applies co-located middleware redirect on client navigation", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-guarded"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="fbr-about"]').should("exist")
    cy.get('[data-testid="fbr-guarded"]').should("not.exist")
  })

  it("FR-04 prerenders dynamic [slug] route on full page load", () => {
    cy.visit("/blog/hello")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("FR-04 navigates to dynamic [slug] via Link after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-blog"]').click()
    cy.location("pathname").should("eq", "/blog/hello")
    cy.get('[data-testid="fbr-blog"]').should("contain", "hello")
  })

  it("FR-05 serves route group without group segment on full page load", () => {
    cy.visit("/pricing")
    cy.location("pathname").should("eq", "/pricing")
    cy.get('[data-testid="fbr-pricing"]').should("have.text", "Pricing")
  })

  it("FR-05 navigates to route group via Link after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-pricing"]').click()
    cy.location("pathname").should("eq", "/pricing")
    cy.get('[data-testid="fbr-pricing"]').should("have.text", "Pricing")
  })

  it("FR-06 serves hand-written route from routes.extend.ts via Link", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-manual"]').click()
    cy.location("pathname").should("eq", "/manual")
    cy.get('[data-testid="fbr-manual"]').should("have.text", "Manual (extend)")
  })

  it("FR-06 serves hand-written route on full page load", () => {
    cy.visit("/manual")
    cy.location("pathname").should("eq", "/manual")
    cy.get('[data-testid="fbr-manual"]').should("have.text", "Manual (extend)")
  })

  it("FR-07 renders not-found UI for unknown paths", () => {
    cy.visit("/does-not-exist", { failOnStatusCode: false })
    cy.get('[data-testid="fbr-not-found"]').should("contain", "Not Found")
  })

  it("FR-07 returns 404 for unknown paths", () => {
    cy.request({ url: "/does-not-exist", failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(404)
      expect(res.body).to.include("Not Found")
    })
  })

  it("FR-08 applies page.config head title on full page load", () => {
    cy.visit("/about")
    cy.title().should("eq", "About — file routes")
  })

  it("FR-08 applies page.config head title after client navigation", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="nav-about"]').click()
    cy.title().should("eq", "About — file routes")
  })
})
