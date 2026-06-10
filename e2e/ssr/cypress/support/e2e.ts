import type { NavDiagnosticsExpect } from "../../src/e2e/routerDiagnostics.js"

declare global {
  namespace Cypress {
    interface Chainable {
      enableKiruDiagnostics(): Chainable<void>
      logRouterDiagnostics(label?: string): Chainable<void>
      waitForNavSettled(timeoutMs?: number): Chainable<void>
      assertNavDiagnostics(expected: NavDiagnosticsExpect): Chainable<void>
      assertNoBlankFrames(maxFrames?: number): Chainable<void>
      resetBlankFrameCount(): Chainable<void>
      historyBack(expected?: NavDiagnosticsExpect): Chainable<void>
      historyForward(expected?: NavDiagnosticsExpect): Chainable<void>
    }
  }
}

Cypress.Commands.add("enableKiruDiagnostics", () => {
  cy.window().then((win) => {
    const originalFetch = win.fetch.bind(win)
    win.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args)
      const url = typeof args[0] === "string" ? args[0] : args[0].url
      if (url.includes("?loader=")) {
        win.__kiruE2eNetworkLog ??= []
        win.__kiruE2eNetworkLog.push({
          url,
          status: res.status,
          at: performance.now(),
        })
      }
      return res
    }
  })
})

Cypress.Commands.add("logRouterDiagnostics", (label?: string) => {
  cy.window().then((win) => {
    const snapshot = win.__kiruE2eDiagnostics?.snapshot(label)
    if (!snapshot) {
      cy.task("logRouterDiagnostics", {
        label: label ?? "missing-diagnostics",
        error: "__kiruE2eDiagnostics not installed",
      })
      return
    }
    cy.task("logRouterDiagnostics", snapshot)
  })
})

Cypress.Commands.add("waitForNavSettled", (timeoutMs = 10_000) => {
  cy.window({ timeout: timeoutMs }).should((win) => {
    const snap = win.__kiruE2eDiagnostics?.snapshot("waitForNavSettled")
    expect(snap?.router, "router diagnostics").to.exist
    expect(snap!.router!.isLoaderPending, "isLoaderPending").to.eq(false)
  })
})

Cypress.Commands.add("assertNavDiagnostics", (expected: NavDiagnosticsExpect) => {
  cy.window().then((win) => {
    const errors = win.__kiruE2eDiagnostics?.assert(expected) ?? [
      "__kiruE2eDiagnostics not installed",
    ]
    if (errors.length > 0) {
      const snapshot = win.__kiruE2eDiagnostics?.snapshot(expected.label)
      cy.task("logRouterDiagnostics", snapshot ?? { label: expected.label })
      throw new Error(
        `[${expected.label}] nav diagnostics failed:\n${errors.join("\n")}`
      )
    }
  })
})

Cypress.Commands.add("resetBlankFrameCount", () => {
  cy.window().then((win) => {
    win.__kiruE2eDiagnostics?.resetBlankFrameCount?.()
  })
})

Cypress.Commands.add("assertNoBlankFrames", (maxFrames = 0) => {
  cy.window().then((win) => {
    const count = win.__kiruBlankFrameCount ?? 0
    if (count > maxFrames) {
      throw new Error(
        `blank #app frames: expected <= ${maxFrames}, got ${count}`
      )
    }
  })
})

Cypress.Commands.add("historyBack", (expected?: NavDiagnosticsExpect) => {
  cy.go("back")
  cy.waitForNavSettled()
  if (expected) cy.assertNavDiagnostics(expected)
})

Cypress.Commands.add("historyForward", (expected?: NavDiagnosticsExpect) => {
  cy.go("forward")
  cy.waitForNavSettled()
  if (expected) cy.assertNavDiagnostics(expected)
})

export {}
