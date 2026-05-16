describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("serves hybrid static /docs route", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/docs`)
    cy.title().should("eq", "E2E SSR Docs (static)")
    cy.get('[data-testid="ssr-docs-static"]').should(
      "contain",
      "Hybrid static docs"
    )
    cy.get("#__kiru_request_context__").should("contain", "E2E User")
    cy.get("script[k-request-token]", { timeout: 10_000 }).should("exist")
  })

  it("hydrates SSR context and enforces navigation guards", () => {
    cy.title().should("eq", "E2E SSR Home")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.get('[data-testid="ssr-user"]').should("contain", "E2E User")
    cy.get('[data-testid="ssr-layout"]').should("exist")

    // /guarded has beforeEnter → / ; client navigation should never commit the guarded page.
    cy.contains("a", "Guarded").click()
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.contains("This page should be redirected away.").should("not.exist")

    cy.contains("a", "Home").click()
    cy.location("pathname").should("eq", "/")

    cy.contains("a", "Blocked (leave-guarded)").click()
    cy.location("pathname").should((pathname) => {
      expect(["/", "/blocked"]).to.include(pathname)
    })
  })

  it("runs beforeEnter on full load and follows SSR redirect", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/guarded`)
    cy.location("pathname").should("eq", "/")
    cy.title().should("eq", "E2E SSR Home")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.contains("This page should be redirected away.").should("not.exist")
  })

  it("handles standard route navigation and dynamic params", () => {
    cy.contains("a", "About").click()
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssr-layout"]').should("exist")

    cy.contains("a", "User 99").click()
    cy.location("pathname").should("eq", "/users/99")
  })

  it("restores route content on browser back/forward", () => {
    cy.contains("a", "About").click()
    cy.location("pathname").should("eq", "/about")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="ssr-layout"]').should("exist")
    cy.go("forward")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssr-layout"]').should("exist")
  })

  it("executes remote functions through server action endpoint", () => {
    // Without the SSR-injected token, the action handler rejects the POST and the UI never updates.
    cy.get("script[k-request-token]", { timeout: 10_000 }).should("exist")
    // Wait for the server round-trip explicitly — avoids races under load / parallel CI.
    cy.intercept("POST", /\?action=/).as("remoteAction")
    cy.get('[data-testid="ssr-remote-button"]').click()
    cy.wait("@remoteAction").its("response.statusCode").should("eq", 200)
    cy.get('[data-testid="ssr-remote-result"]').should(
      "have.text",
      "hello from server (E2E User)"
    )
  })

  it("hydrates the hello route on full load", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/hello`)
    cy.get('[data-testid="ssr-loader"]').should(
      "contain",
      "Hello route (SSR + hydration smoke test)."
    )
  })

  it("renders scoped notFound route for unknown paths", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/missing-ssr-route`, {
      failOnStatusCode: false,
    })
    cy.get('[data-testid="ssr-not-found"]').should("contain", "SSR not found")
  })

  describe("streaming SSR", () => {
    // The /streaming-test route awaits a 4s remote action before resolving its
    // resource. The whole point of streaming is that the shell, the loading
    // fallback, and the entry script all reach the browser well before that —
    // and that hydration runs straight away so the page is interactive while
    // the resource is still pending.
    const TODOS_DELAY_MS = 4000
    const SHELL_BUDGET_MS = 1500
    const HYDRATION_BUDGET_MS = 2000

    type StreamingMarks = {
      shellAt?: number
      fallbackAt?: number
    }
    type StreamingWin = Cypress.AUTWindow & {
      __streamingMarks?: StreamingMarks
      __kiruHydratedAt?: number
      __kiruFallbackVisibleAtHydration?: boolean
    }

    /**
     * `cy.visit()` blocks on the page `load` event, which only fires once the
     * full streamed response is closed (~4s here). To measure honestly we
     * install a `MutationObserver` in `onBeforeLoad` and record marks
     * against the AUT window's `performance.now()` (which is 0-aligned with
     * navigation start), reading them back after the visit completes.
     *
     * CRITICAL: every timestamp here MUST use `win.performance.now()` (the
     * AUT's clock) rather than the test runner's `performance` — the two
     * have different `timeOrigin`s, and mixing them produces nonsense
     * arithmetic that can quietly let regressions pass.
     */
    function visitStreamingPage(port: number) {
      return cy.visit(`http://127.0.0.1:${port}/streaming-test`, {
        onBeforeLoad(win) {
          const w = win as StreamingWin
          const marks: StreamingMarks = {}
          w.__streamingMarks = marks

          new MutationObserver(() => {
            if (
              !marks.shellAt &&
              w.document.querySelector('[data-testid="streaming-page"]')
            ) {
              marks.shellAt = w.performance.now()
            }
            if (
              !marks.fallbackAt &&
              w.document.querySelector('[data-testid="streaming-fallback"]')
            ) {
              marks.fallbackAt = w.performance.now()
            }
          }).observe(w.document.documentElement, {
            childList: true,
            subtree: true,
          })
        },
      })
    }

    it("streams the shell and fallback well before the resource resolves", () => {
      visitStreamingPage(Cypress.env("port"))

      cy.window().then((win) => {
        const marks = (win as StreamingWin).__streamingMarks
        expect(marks, "MutationObserver marks were captured").to.exist
        expect(marks!.shellAt, "shell streamed before load").to.exist
        expect(marks!.fallbackAt, "fallback streamed before load").to.exist
        // AUT `performance.now()` is time-since-navigation-start, so the
        // raw mark is directly comparable to the budget.
        expect(marks!.shellAt!).to.be.lessThan(SHELL_BUDGET_MS)
        expect(marks!.fallbackAt!).to.be.lessThan(SHELL_BUDGET_MS)
      })
    })

    it("hydrates before the streamed resource resolves", () => {
      visitStreamingPage(Cypress.env("port"))

      cy.window()
        .should((win) => {
          // `bootstrapSsrClient` is async (dynamic route import + hydrate),
          // so the timestamp may settle a tick after page `load`. Retry until
          // it appears, with the same budget the bug constraint requires.
          expect((win as StreamingWin).__kiruHydratedAt).to.be.a("number")
        })
        .then((win) => {
          const w = win as StreamingWin
          const marks = w.__streamingMarks!
          // `__kiruHydratedAt` is set inside the AUT via its own
          // `performance.now()`, so it's already time-since-navigation.
          // Surface measured timings in the assertion message so a future
          // regression points straight at the actual delay.
          const tag = `[timings] shellAt=${marks.shellAt}ms fallbackAt=${marks.fallbackAt}ms hydratedAt=${w.__kiruHydratedAt}ms fallbackVisible=${w.__kiruFallbackVisibleAtHydration}`
          expect(
            w.__kiruHydratedAt!,
            `hydration finished within budget (AUT clock) — ${tag}`
          ).to.be.lessThan(HYDRATION_BUDGET_MS)

          // `cy.visit` waits for the page `load` event, by which point the
          // resource has long since resolved. The page captures the
          // fallback's presence at the exact moment hydration finished, so
          // we can still assert that interactivity preceded the data.
          expect(
            w.__kiruFallbackVisibleAtHydration,
            "fallback was still visible the moment hydration finished"
          ).to.eq(true)
        })
    })

    it("fills in the todos once the streamed resource resolves", () => {
      visitStreamingPage(Cypress.env("port"))

      cy.get('[data-testid="streaming-todos"]', {
        timeout: TODOS_DELAY_MS + 2000,
      })
        .find('[data-testid="streaming-todo"]')
        .should("have.length", 2)
        .then(($items) => {
          expect($items.eq(0).text()).to.eq("buy coffee")
          expect($items.eq(1).text()).to.eq("write tests")
        })

      cy.get('[data-testid="streaming-fallback"]').should("not.exist")

      // Counter state survived the streamed-data swap-in.
      cy.get('[data-testid="streaming-counter"]')
        .click()
        .should("contain", "Count: 1")
    })
  })
})
