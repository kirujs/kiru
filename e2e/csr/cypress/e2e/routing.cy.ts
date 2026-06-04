describe("router", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}`)
  })

  it("displays the correct route child element", () => {
    cy.get("main #router-outlet h2").should("exist").should("have.text", "Home")
  })

  it("reacts to a <Link /> click appropriately", () => {
    cy.get('nav a[href="/about"]').click()
    cy.get('[data-testid="csr-about"]').should("exist")
    cy.get('[data-testid="locale-title"]').should("contain", "About")
  })

  it("reacts to a history-api triggered navigation event", () => {
    cy.get('nav a[href="/about"]').click()
    cy.go("back")
    cy.get("main #router-outlet h2").should("exist").should("have.text", "Home")
  })

  it("renders dynamic params route", () => {
    cy.get('nav a[href="/users/42"]').click()
    cy.get('[data-testid="csr-user"]').should("contain", "User 42")
  })

  it("applies route-level redirect guard", () => {
    cy.get('nav a[href="/guarded"]').click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="locale-title"]').should("contain", "About")
  })

  it("renders notFound route for unknown paths", () => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/this-route-does-not-exist`)
    cy.get('[data-testid="csr-not-found"]').should("contain", "Not Found")
  })

  it("awaitable navigate returns committed and updates matches", () => {
    cy.visit(`http://localhost:${Cypress.env("port")}/navigation`)
    cy.get('[data-testid="match-depth"]').should("contain", "2")
    cy.get('[data-testid="nav-programmatic"]').click()
    cy.get('[data-testid="nav-result"]').should("contain", "committed")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="locale-title"]').should("contain", "About")
  })
})
