describe("SSG client parity (S3)", () => {
  it("runs clientLoader on first paint after hydrate", () => {
    cy.visit("/invalidate-demo")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="ssg-invalidate-invocations"]').should("have.text", "1")
  })

  it("router.invalidate on current route does not full-reload the document", () => {
    cy.visit("/invalidate-demo")
    cy.get("#app").invoke("attr", "data-kiru-hydrated-at").then((t0) => {
      cy.get('[data-testid="ssg-invalidate-trigger"]').click()
      cy.get("#app").invoke("attr", "data-kiru-hydrated-at").should("eq", t0)
    })
  })

  it("applies middleware redirect on client navigation after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.contains("a", "Guarded").click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
    cy.get('[data-testid="ssg-guarded"]').should("not.exist")
  })

  it("shows error route when a leaf throws after client navigation", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.contains("a", "Break").click()
    cy.location("pathname").should("eq", "/break-leaf")
    cy.get('[data-testid="ssg-error-page"]').should("contain", "SSG break leaf")
  })

  it("preserves static loader data across client navigation", () => {
    cy.visit("/loaders/static")
    cy.get('[data-testid="loader-data"]').should("contain", "static:prerendered")
    cy.contains("a", "Home").click()
    cy.contains("a", "Static loader").click()
    cy.get('[data-testid="loader-data"]').should("contain", "static:prerendered")
  })

  it("navigates to locale-prefixed path after hydrate", () => {
    cy.visit("/about")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="locale-switch-fr"]').click()
    cy.location("pathname").should("eq", "/fr/about")
    cy.get('[data-testid="locale-code"]').should("have.text", "fr")
  })

  it("prerenders invalidate-demo route HTML", () => {
    cy.request("/invalidate-demo").then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include("ssg-invalidate-demo")
    })
  })

  it("client navigation to about from home after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.contains("a", "About").click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })

  it("navigates to invalidate-demo via Link after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.contains("a", "Invalidate demo").click()
    cy.location("pathname").should("eq", "/invalidate-demo")
    cy.get('[data-testid="ssg-invalidate-demo"]').should("exist")
  })

  it("supports browser history after visiting invalidate-demo", () => {
    cy.visit("/")
    cy.visit("/invalidate-demo")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.go("forward")
    cy.location("pathname").should("eq", "/invalidate-demo")
  })
})
