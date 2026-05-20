type E2eAuthMode = "anonymous" | "user" | "slow"

function visitWithAuth(path: string, auth: E2eAuthMode = "anonymous") {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.__E2E_AUTH__ = auth
      win.sessionStorage.setItem("kiru-e2e-auth", auth)
    },
  })
}

/** Client router + Link handlers are ready after SSG hydrate (see `__kiruHydratedAt`). */
function waitForHydratedRouter() {
  cy.window()
    .its("__kiruHydratedAt", { timeout: 10000 })
    .should("be.a", "number")
}

describe("request context and context gate (SSG)", () => {
  it("prerendered public context home shows guest without gate UI", () => {
    visitWithAuth("/context", "anonymous")
    cy.get('[data-testid="context-home"]').should("contain", "guest")
    cy.get('[data-testid="context-pending"]').should("not.exist")
  })

  it("client navigation to protected admin redirects when guest", () => {
    visitWithAuth("/context", "anonymous")
    cy.get('[data-testid="context-home"]').should("contain", "guest")
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.location("pathname", { timeout: 15000 }).should("eq", "/context/login")
    cy.get('[data-testid="admin-loader-marker"]').should("not.exist")
  })

  it("client navigation stays in-flight while session resolves slowly", () => {
    visitWithAuth("/context", "slow")
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.window().its("__KIRU_NAV__", { timeout: 2000 }).should(
      (nav) => {
        expect(nav?.isNavigating).to.eq(true)
      }
    )
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/login")
  })

  it("nested scope contextPendingFallback overrides app fallback on block route", () => {
    visitWithAuth("/context", "slow")
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.get('[data-testid="context-pending-scope"]').should(
      "contain",
      "Blocking admin area"
    )
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.get('[data-testid="context-admin"]').should("not.exist")
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/login")
  })

  it("signed-in client navigation reaches admin after hydrate", () => {
    visitWithAuth("/context", "user")
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/admin")
    cy.get('[data-testid="admin-loader-marker"]', { timeout: 10000 }).should(
      "contain",
      "admin-loader-ran"
    )
  })

  it("background profile route renders without blocking the outlet", () => {
    visitWithAuth("/context", "user")
    waitForHydratedRouter()
    cy.contains("a", "Context profile").click()
    cy.location("pathname").should("eq", "/context/profile")
    cy.get('[data-testid="context-profile-body"]').should("exist")
    cy.get('[data-testid="context-pending"]').should("not.exist")
    cy.get('[data-testid="context-user-label"]', { timeout: 10000 }).should(
      "contain",
      "user:E2E User"
    )
  })

  it("login flow after client navigation from prerendered home", () => {
    visitWithAuth("/context", "anonymous")
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.get('[data-testid="login-as-user"]').click()
    cy.window().then((win) => {
      win.__E2E_AUTH__ = "user"
      win.sessionStorage.setItem("kiru-e2e-auth", "user")
    })
    waitForHydratedRouter()
    cy.contains("a", "Context admin").click()
    cy.location("pathname", { timeout: 10000 }).should("eq", "/context/admin")
    cy.get('[data-testid="context-admin-secret"]').should("contain", "admin-area")
  })
})
