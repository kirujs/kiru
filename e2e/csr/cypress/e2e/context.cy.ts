type E2eAuthMode = "anonymous" | "user" | "slow"

function visitWithAuth(path: string, auth: E2eAuthMode = "anonymous") {
  const port = Cypress.env("port")
  cy.visit(`http://127.0.0.1:${port}${path}`, {
    onBeforeLoad(win) {
      win.__E2E_AUTH__ = auth
      win.sessionStorage.setItem("kiru-e2e-auth", auth)
    },
  })
}

describe("request context and context gate (CSR)", () => {
  it("contextStrategy none: public home paints without session gate", () => {
    visitWithAuth("/context", "anonymous")
    cy.get('[data-testid="context-home"]').should("exist")
    cy.get('[data-testid="context-user-label"]').should("contain", "guest")
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.get('[data-testid="context-admin-secret"]').should("not.exist")
  })

  it("contextStrategy block: guest navigation to admin redirects without running loaders", () => {
    visitWithAuth("/context", "anonymous")
    cy.contains("a", "context-admin").click()
    cy.location("pathname").should("eq", "/context/login")
    cy.get('[data-testid="context-login"]').should("exist")
    cy.get('[data-testid="admin-loader-marker"]').should("not.exist")
    cy.get('[data-testid="context-admin-secret"]').should("not.exist")
  })

  it("nested scope contextPendingFallback overrides app fallback on block route", () => {
    visitWithAuth("/context/admin", "slow")
    cy.get('[data-testid="context-pending-scope"]').should(
      "contain",
      "Blocking admin area"
    )
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.get('[data-testid="context-admin"]').should("not.exist")
  })

  it("nested scope contextPendingFallback during client navigation to block route", () => {
    visitWithAuth("/context", "slow")
    cy.contains("a", "context-admin").click()
    cy.get('[data-testid="context-pending-scope"]').should(
      "contain",
      "Blocking admin area"
    )
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/login")
  })

  it("contextStrategy block: slow resolve keeps navigation in flight before login redirect", () => {
    visitWithAuth("/context", "slow")
    cy.contains("a", "context-admin").click()
    cy.window().its("__KIRU_NAV__", { timeout: 2000 }).should(
      (nav) => {
        expect(nav?.isNavigating).to.eq(true)
        expect(nav?.to).to.include("/context/admin")
      }
    )
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/login")
    cy.get('[data-testid="admin-loader-marker"]').should("not.exist")
  })

  it("authenticated user reaches admin and runs clientLoader", () => {
    visitWithAuth("/context/admin", "user")
    cy.get('[data-testid="context-admin"]').should("exist")
    cy.get('[data-testid="context-admin-secret"]').should("contain", "admin-area")
    cy.get('[data-testid="admin-loader-marker"]').should(
      "contain",
      "admin-loader-ran"
    )
  })

  it("requireAuth middleware preserves next URL on login redirect", () => {
    visitWithAuth("/context", "anonymous")
    cy.contains("a", "context-admin").click()
    cy.url().should("include", "next=")
    cy.location("pathname").should("eq", "/context/login")
  })

  it("contextStrategy background: profile renders before session resolves", () => {
    visitWithAuth("/context/profile", "slow")
    cy.get('[data-testid="context-profile-body"]').should(
      "contain",
      "profile-area"
    )
    cy.get('[data-testid="context-user-label"]').should("contain", "guest")
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.get('[data-testid="context-user-label"]', { timeout: 8000 }).should(
      "contain",
      "guest"
    )
  })

  it("contextStrategy background: updates chrome after session resolves for signed-in user", () => {
    visitWithAuth("/context/profile", "user")
    cy.get('[data-testid="context-profile-body"]').should("exist")
    cy.get('[data-testid="context-user-label"]', { timeout: 8000 }).should(
      "contain",
      "user:E2E User"
    )
  })

  it("login flow: signing in persists session and unlocks admin", () => {
    visitWithAuth("/context", "anonymous")
    cy.contains("a", "context-admin").click()
    cy.location("pathname").should("eq", "/context/login")
    cy.get('[data-testid="login-as-user"]').click()
    cy.window().then((win) => {
      win.__E2E_AUTH__ = "user"
      win.sessionStorage.setItem("kiru-e2e-auth", "user")
    })
    visitWithAuth("/context/admin", "user")
    cy.get('[data-testid="admin-loader-marker"]').should(
      "contain",
      "admin-loader-ran"
    )
  })
})
