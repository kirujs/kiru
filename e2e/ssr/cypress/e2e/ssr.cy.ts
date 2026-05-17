describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("renders serverLoader data on history back and forward", () => {
    cy.intercept("POST", /\?loader=/).as("serverLoader")

    // Client navigation only — a full cy.visit() history entry restores SSR HTML on
    // back without a ?loader= POST. Wait for hydration so Link uses the router.
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.contains("a", /^Server loader$/).click()
    cy.wait("@serverLoader")
    cy.location("pathname").should("eq", "/loaders/server")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )

    cy.contains("a", "Home").click()
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="ssr-home"]').should("exist")

    cy.go("back")
    cy.wait("@serverLoader")
    cy.location("pathname").should("eq", "/loaders/server")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )

    cy.go("forward")
    cy.location("pathname").should("eq", "/")
    cy.get('[data-testid="ssr-home"]').should("exist")

    cy.go("back")
    cy.wait("@serverLoader")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )
  })

  it("renders serverLoader data on first paint and after client navigation", () => {
    const port = Cypress.env("port")
    cy.request(`http://127.0.0.1:${port}/loaders/server`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.match(/server@(&#47;|\/)loaders(&#47;|\/)server/)
    })
    cy.visit(`http://127.0.0.1:${port}/loaders/server`)
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )
    cy.contains("a", "Home").click()
    cy.visit(`http://127.0.0.1:${port}/loaders/server`)
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )
  })

  it("serves hybrid static /docs route", () => {
    const port = Cypress.env("port")
    // Request context is injected in SSR HTML but removed from the DOM during
    // hydration (readHydratedRequestContext), so assert it on the raw response.
    cy.request(`http://127.0.0.1:${port}/docs`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include('k-request-context')
      expect(res.body).to.include("E2E User")
      expect(res.body).to.include("Hybrid static docs")
    })

    cy.visit(`http://127.0.0.1:${port}/docs`)
    cy.title().should("eq", "E2E SSR Docs (static)")
    cy.get('[data-testid="ssr-docs-static"]').should(
      "contain",
      "Hybrid static docs"
    )
    cy.get('[data-testid="ssr-docs-user"]').should("contain", "E2E User")
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
    cy.intercept("GET", /\?action=/).as("remoteAction")
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

  describe("SSR error pages", () => {
    it("renders scope error module when a matched route throws (500)", () => {
      const port = Cypress.env("port")
      cy.request({
        url: `http://127.0.0.1:${port}/ssr-break`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(500)
        expect(res.body).to.include("e2e-ssr-boom")
        expect(res.body).to.include('data-testid="ssr-error-page"')
        expect(res.body).to.include('data-testid="ssr-layout"')
      })

      cy.visit(`http://127.0.0.1:${port}/ssr-break`, {
        failOnStatusCode: false,
      })
      cy.get('[data-testid="ssr-layout"]').should("exist")
      cy.get('[data-testid="ssr-error-page"]').should(
        "contain",
        "SSR error boundary: e2e-ssr-boom"
      )
    })

    it("uses leaf route error over scope error", () => {
      const port = Cypress.env("port")
      cy.request({
        url: `http://127.0.0.1:${port}/ssr-break-leaf`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(500)
        expect(res.body).to.include("e2e-ssr-leaf-boom")
        expect(res.body).to.include('data-testid="ssr-leaf-error-page"')
        expect(res.body).not.to.include('data-testid="ssr-error-page"')
      })

      cy.visit(`http://127.0.0.1:${port}/ssr-break-leaf`, {
        failOnStatusCode: false,
      })
      cy.get('[data-testid="ssr-layout"]').should("exist")
      cy.get('[data-testid="ssr-leaf-error-page"]').should(
        "contain",
        "Leaf error: e2e-ssr-leaf-boom"
      )
      cy.get('[data-testid="ssr-error-page"]').should("not.exist")
    })
  })

  describe("server loader immediate shell", () => {
    const LOADER_DELAY_MS = 1000
    const SHELL_BUDGET_MS = 600
    const HYDRATION_BUDGET_MS = 800

    type ImmediateShellMarks = {
      layoutAt?: number
      fallbackAt?: number
    }
    type ImmediateShellWin = Cypress.AUTWindow & {
      __immediateShellMarks?: ImmediateShellMarks
      __kiruHydratedAt?: number
      __kiruFallbackVisibleAtHydration?: boolean
    }

    function visitImmediateShellPage(port: number) {
      return cy.visit(
        `http://127.0.0.1:${port}/loaders/server-immediate-shell`,
        {
          onBeforeLoad(win) {
            const w = win as ImmediateShellWin
            const marks: ImmediateShellMarks = {}
            w.__immediateShellMarks = marks

            new MutationObserver(() => {
              if (
                !marks.layoutAt &&
                w.document.querySelector('[data-testid="ssr-layout"]')
              ) {
                marks.layoutAt = w.performance.now()
              }
              if (
                !marks.fallbackAt &&
                w.document.querySelector('[data-testid="loader-fallback"]')
              ) {
                marks.fallbackAt = w.performance.now()
              }
            }).observe(w.document.documentElement, {
              childList: true,
              subtree: true,
            })
          },
        }
      )
    }

    it("streams layout and fallback before the slow server loader resolves", () => {
      visitImmediateShellPage(Cypress.env("port"))

      cy.window().then((win) => {
        const marks = (win as ImmediateShellWin).__immediateShellMarks
        expect(marks, "MutationObserver marks were captured").to.exist
        expect(marks!.layoutAt, "layout streamed before load").to.exist
        expect(marks!.fallbackAt, "fallback streamed before load").to.exist
        expect(marks!.layoutAt!).to.be.lessThan(SHELL_BUDGET_MS)
        expect(marks!.fallbackAt!).to.be.lessThan(SHELL_BUDGET_MS)
      })
    })

    it("hydrates while the fallback is still visible, then resolves loader data", () => {
      visitImmediateShellPage(Cypress.env("port"))

      cy.window()
        .should((win) => {
          expect((win as ImmediateShellWin).__kiruHydratedAt).to.be.a("number")
        })
        .then((win) => {
          const w = win as ImmediateShellWin
          const marks = w.__immediateShellMarks!
          const tag = `[timings] layoutAt=${marks.layoutAt}ms fallbackAt=${marks.fallbackAt}ms hydratedAt=${w.__kiruHydratedAt}ms fallbackVisible=${w.__kiruFallbackVisibleAtHydration}`
          expect(
            w.__kiruHydratedAt!,
            `hydration finished within budget (AUT clock) — ${tag}`
          ).to.be.lessThan(HYDRATION_BUDGET_MS)
          expect(
            w.__kiruFallbackVisibleAtHydration,
            "loader fallback was still visible the moment hydration finished"
          ).to.eq(true)
        })

      cy.get('[data-testid="loader-data"]', {
        timeout: LOADER_DELAY_MS + 2000,
      }).should("contain", "server@/loaders/server-immediate-shell")
      cy.get('[data-testid="loader-fallback"]').should("not.exist")
    })

    it("serves streamed loader data in the full HTML response", () => {
      const port = Cypress.env("port")
      cy.request({
        url: `http://127.0.0.1:${port}/loaders/server-immediate-shell`,
        timeout: LOADER_DELAY_MS + 5000,
      }).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include('data-testid="loader-fallback"')
        expect(res.body).to.include(
          '"pathname":"/loaders/server-immediate-shell"'
        )
        expect(res.body).to.include('"source":"server"')
        expect(res.body).to.include("__$k_data")
      })
    })
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

  describe("nested streaming SSR", () => {
    const NESTED_STREAM_MS = 2000
    const NESTED_TOTAL_MS = NESTED_STREAM_MS * 2

    it("streams parent and nested resource data in one response", () => {
      const port = Cypress.env("port")
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
      const port = Cypress.env("port")
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
      const port = Cypress.env("port")
      cy.intercept("POST", /\?loader=/).as("serverLoader")

      cy.visit(`http://127.0.0.1:${port}/nested-streaming-test`)
      cy.get('[data-testid="product-fallback"]').should("be.visible")
      cy.window()
        .its("__kiruHydratedAt")
        .should("be.a", "number")
      cy.contains("a", "Server loader").click()

      cy.wait("@serverLoader", { timeout: 10000 })
        .its("response.statusCode")
        .should("eq", 200)
      cy.location("pathname").should("eq", "/loaders/server")
      cy.get('[data-testid="loader-data"]').should(
        "contain",
        "server@/loaders/server"
      )
    })
  })

  describe("SEO and structured data", () => {
    it("includes JSON-LD in SSR HTML", () => {
      const port = Cypress.env("port")
      cy.request(`http://127.0.0.1:${port}/`).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include("application/ld+json")
        expect(res.body).to.include("E2E SSR Home")
      })
    })

    it("renders the SEO demo route with document title", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/seo`)
      cy.title().should("eq", "E2E SSR SEO")
      cy.get('[data-testid="ssr-seo"]').should("exist")
    })
  })

  describe("document head on client navigation", () => {
    it("updates title and JSON-LD when navigating between routes", () => {
      cy.title().should("eq", "E2E SSR Home")
      cy.get('head script[type="application/ld+json"]').should(
        "contain",
        "E2E SSR Home"
      )

      cy.contains("a", "SEO").click()
      cy.location("pathname").should("eq", "/seo")
      cy.get('[data-testid="ssr-seo"]').should("exist")
      cy.title().should("eq", "E2E SSR SEO")
      cy.get('head script[type="application/ld+json"]').should(
        "contain",
        "E2E SSR SEO"
      )

      cy.contains("a", "Home").click()
      cy.location("pathname").should("eq", "/")
      cy.title().should("eq", "E2E SSR Home")
      cy.get('head script[type="application/ld+json"]').should(
        "contain",
        "E2E SSR Home"
      )
    })

    it("updates title for static and dynamic routes", () => {
      cy.title().should("eq", "E2E SSR Home")

      cy.contains("a", "About").click()
      cy.location("pathname").should("eq", "/about")
      cy.get('[data-testid="ssr-about"]').should("exist")
      cy.title().should("eq", "E2E SSR About")

      cy.contains("a", "User 99").click()
      cy.location("pathname").should("eq", "/users/99")
      cy.title().should("eq", "E2E SSR User 99")
    })

    it("applies page defineHeadContent over route head after client navigation", () => {
      cy.title().should("eq", "E2E SSR Home")

      cy.contains("a", "Head override").click()
      cy.location("pathname").should("eq", "/head-override")
      cy.get('[data-testid="ssr-head-override"]').should("exist")
      cy.title().should("eq", "E2E SSR From page head export")

      cy.contains("a", "Home").click()
      cy.location("pathname").should("eq", "/")
      cy.title().should("eq", "E2E SSR Home")
    })
  })
})
