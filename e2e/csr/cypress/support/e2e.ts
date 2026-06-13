import type { CsrNavDiagnosticsExpect } from "../../src/e2e/csrRouterDiagnostics.js"

declare global {
  namespace Cypress {
    interface Chainable {
      enableKiruDiagnostics(): Chainable<void>
      logRouterDiagnostics(label?: string): Chainable<void>
      waitForNavSettled(timeoutMs?: number): Chainable<void>
      assertCsrNavDiagnostics(expected: CsrNavDiagnosticsExpect): Chainable<void>
    }
  }
}

Cypress.Commands.add("enableKiruDiagnostics", () => {
  cy.window().then((win) => {
    win.__kiruOutletDebug = true
    win.__kiruOutletDebugLog = []
  })
})

Cypress.Commands.add("logRouterDiagnostics", (label?: string) => {
  cy.window().then((win) => {
    const snapshot = win.__kiruCsrE2eDiagnostics?.snapshot(label)
    if (!snapshot) {
      cy.task("logRouterDiagnostics", {
        label: label ?? "missing-diagnostics",
        error: "__kiruCsrE2eDiagnostics not installed",
      })
      return
    }
    cy.task("logRouterDiagnostics", snapshot)
  })
})

Cypress.Commands.add("waitForNavSettled", (timeoutMs = 10_000) => {
  cy.window({ timeout: timeoutMs }).should((win) => {
    const snap = win.__kiruCsrE2eDiagnostics?.snapshot("waitForNavSettled")
    expect(snap?.router, "router diagnostics").to.exist
    expect(snap!.router!.isLoaderPending, "isLoaderPending").to.eq(false)
  })
})

Cypress.Commands.add(
  "assertCsrNavDiagnostics",
  (expected: CsrNavDiagnosticsExpect) => {
    cy.window().then((win) => {
      const errors = win.__kiruCsrE2eDiagnostics?.assert(expected) ?? [
        "__kiruCsrE2eDiagnostics not installed",
      ]
      if (errors.length > 0) {
        const snapshot = win.__kiruCsrE2eDiagnostics?.snapshot(expected.label)
        cy.task("logRouterDiagnostics", snapshot ?? { label: expected.label })
        throw new Error(
          `[${expected.label}] nav diagnostics failed:\n${errors.join("\n")}`
        )
      }
    })
  }
)

afterEach(function () {
  if (this.currentTest?.state === "failed") {
    cy.logRouterDiagnostics(`failed:${this.currentTest.title}`)
  }
})

import "./commands"

export {}
