describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)
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
      visitStreamingPage(Cypress.expose("port"))

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
      visitStreamingPage(Cypress.expose("port"))

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
      visitStreamingPage(Cypress.expose("port"))

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

  describe("nested streaming SSR", () => {
    const NESTED_STREAM_MS = 2000
    const NESTED_TOTAL_MS = NESTED_STREAM_MS * 2

    it("streams parent and nested resource data in one response", () => {
      const port = Cypress.expose("port")
      cy.request({
        url: `http://127.0.0.1:${port}/nested-streaming-test`,
        timeout: NESTED_TOTAL_MS + 5000,
      }).then((res) => {
        expect(res.status).to.eq(200)
        const dataScripts = res.body.match(/__\$k_data\("/g) ?? []
        expect(dataScripts).to.have.length(2)
        expect(res.body).to.include('data-testid="product-fallback"')
        expect(res.body).not.to.include('data-testid="reviews-list"')
      })
    })

    it("hydrates nested reviews after both resources resolve", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/nested-streaming-test`, {
        timeout: NESTED_TOTAL_MS + 5000,
      })
      cy.get('[data-testid="reviews-list"]', {
        timeout: NESTED_TOTAL_MS + 2000,
      })
        .find('[data-testid="review-item"]')
        .should("have.length", 1)
        .and("contain", "Review for p1")
      cy.get('[data-testid="product-fallback"]').should("not.exist")
      cy.get('[data-testid="reviews-fallback"]').should("not.exist")
    })

    it("can client-navigate to a server-loader route while streaming is pending", () => {
      const port = Cypress.expose("port")
      cy.intercept("POST", /\?loader=/).as("serverLoader")

      cy.visit(`http://127.0.0.1:${port}/nested-streaming-test`)
      cy.get('[data-testid="product-fallback"]').should("be.visible")
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.contains("a", "Server loader").click()

      cy.wait("@serverLoader").its("response.statusCode").should("eq", 200)
      cy.location("pathname").should("eq", "/loaders/server")
      cy.get('[data-testid="loader-data"]').should(
        "contain",
        "server@/loaders/server"
      )
    })
  })
})
