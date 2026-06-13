/**
 * CSR navigation diagnostics — captures comparable timelines for visit vs Link vs
 * programmatic navigate. Findings (2026-06): compare G (forbidden middleware) vs
 * F (csr-break throw) to isolate ErrorBoundary vs outletRenderError paths.
 */

type Scenario = {
  id: string
  action: (port: number) => void
  expectedDom: Partial<Record<string, boolean>>
  pathname: string
}

function visitWithDebug(path: string) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.__kiruOutletDebug = true
      win.__kiruOutletDebugLog = []
    },
  })
  cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
}

function logTimeline(label: string) {
  cy.logRouterDiagnostics(label)
  cy.window().then((win) => {
    const log = win.__kiruOutletDebugLog ?? []
    cy.task("logRouterDiagnostics", {
      label: `${label}:outletDebugLog`,
      events: log.map((e) => ({ event: e.event, data: e.data })),
    })
  })
}

describe("CSR navigation diagnostics", () => {
  const port = () => Cypress.env("port") as number

  afterEach(function () {
    if (this.currentTest?.state === "failed") {
      cy.logRouterDiagnostics(`failed:${this.currentTest?.title}`)
    }
  })

  const scenarios: Scenario[] = [
    {
      id: "A-visit-home",
      action: () => visitWithDebug(`http://127.0.0.1:${port()}/`),
      expectedDom: { home: true },
      pathname: "/",
    },
    {
      id: "B-visit-about",
      action: () => visitWithDebug(`http://127.0.0.1:${port()}/about`),
      expectedDom: { about: true },
      pathname: "/about",
    },
    {
      id: "C-link-about",
      action: () => {
        visitWithDebug(`http://127.0.0.1:${port()}/`)
        cy.window().then((win) => {
          win.__kiruOutletDebugLog = []
        })
        cy.get('nav a[href="/about"]').click()
      },
      expectedDom: { about: true },
      pathname: "/about",
    },
    {
      id: "D-programmatic-about",
      action: () => {
        visitWithDebug(`http://127.0.0.1:${port()}/`)
        cy.window().then((win) => {
          win.__kiruOutletDebugLog = []
          const router = win.__kiru_router
          if (!router) throw new Error("__kiru_router missing")
          void router.navigate("/about")
        })
      },
      expectedDom: { about: true },
      pathname: "/about",
    },
    {
      id: "E-link-loaders-client",
      action: () => {
        visitWithDebug(`http://127.0.0.1:${port()}/`)
        cy.window().then((win) => {
          win.__kiruOutletDebugLog = []
        })
        cy.get('[data-testid="nav-loaders-client"]').click()
      },
      expectedDom: { loaderData: true },
      pathname: "/loaders/client",
    },
    {
      id: "F-link-csr-break",
      action: () => {
        visitWithDebug(`http://127.0.0.1:${port()}/`)
        cy.window().then((win) => {
          win.__kiruOutletDebugLog = []
        })
        cy.get('[data-testid="nav-csr-break"]').click()
      },
      expectedDom: { errorPage: true },
      pathname: "/csr-break",
    },
    {
      id: "G-link-forbidden",
      action: () => {
        visitWithDebug(`http://127.0.0.1:${port()}/`)
        cy.window().then((win) => {
          win.__kiruOutletDebugLog = []
        })
        cy.get('[data-testid="nav-forbidden"]').click()
      },
      expectedDom: { errorPage: true },
      pathname: "/forbidden",
    },
  ]

  for (const scenario of scenarios) {
    it(`captures timeline: ${scenario.id}`, () => {
      scenario.action(port())
      cy.location("pathname").should("eq", scenario.pathname)

      logTimeline(`${scenario.id}:immediate`)
      cy.waitForNavSettled()
      cy.wait(500)
      logTimeline(`${scenario.id}:t+500ms`)

      cy.window().then((win) => {
        const snap = win.__kiruCsrE2eDiagnostics?.snapshot(scenario.id)
        cy.task("logRouterDiagnostics", snap ?? { label: scenario.id })
        for (const [key, value] of Object.entries(scenario.expectedDom)) {
          const domKey = key as keyof NonNullable<typeof snap>["dom"]
          if (snap && snap.dom[domKey] !== value) {
            throw new Error(
              `[${scenario.id}] dom.${key}: expected ${value}, got ${snap.dom[domKey]} — see [kiru csr diagnostics] stdout`
            )
          }
        }
      })
    })
  }
})
