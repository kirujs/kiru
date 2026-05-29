describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("proves full home-page hydration completes without hydration errors", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`, {
      onBeforeLoad(win) {
        ;(
          win as typeof win & { __e2eConsoleErrors?: string[] }
        ).__e2eConsoleErrors = []
        const prevError = win.console.error.bind(win.console)
        win.console.error = (...args: unknown[]) => {
          ;(
            win as typeof win & { __e2eConsoleErrors?: string[] }
          ).__e2eConsoleErrors!.push(
            args
              .map((a) => {
                try {
                  return typeof a === "string" ? a : JSON.stringify(a)
                } catch {
                  return String(a)
                }
              })
              .join(" ")
          )
          prevError(...args)
        }
      },
    })

    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="ssr-home"]').should("have.text", "SSR e2e home")
    cy.get('[data-testid="ssr-user"]').should("contain", "User:")
    cy.get('[data-testid="ssr-remote-button"]').should(
      "have.text",
      "Call remote"
    )
    cy.get('[data-testid="ssr-remote-result"]').should("exist")

    cy.window().then((win) => {
      const hydrationErrors = (win.__kiruHydrationErrors ?? []).map(String)
      expect(
        hydrationErrors,
        `unexpected hydration errors: ${hydrationErrors.join(" | ")}`
      ).to.deep.eq([])
      const traceLen = win.__kiruHydrationTrace?.length ?? 0
      expect(traceLen, "hydration trace entries recorded").to.be.greaterThan(0)

      const consoleErrors =
        (win as typeof win & { __e2eConsoleErrors?: string[] })
          .__e2eConsoleErrors ?? []
      const hydrationConsoleErrors = consoleErrors.filter((line) =>
        /hydration mismatch|no template shell element found|kiruerror/i.test(
          line
        )
      )
      expect(
        hydrationConsoleErrors,
        `unexpected hydration console errors: ${hydrationConsoleErrors.join(
          " | "
        )}`
      ).to.deep.eq([])
    })
  })

  it("serves hybrid static /docs route", () => {
    const port = Cypress.expose("port")
    // Request context is injected in SSR HTML but removed from the DOM during
    // hydration (readHydratedRequestContext), so assert it on the raw response.
    cy.request(`http://127.0.0.1:${port}/docs`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include("k-request-context")
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
    cy.get("script[k-request-token]").should("exist")
  })

  it("renders query in SSR HTML and hash after hydration for useRouter", () => {
    const port = Cypress.expose("port")
    // Fragments are not sent on HTTP requests — the server never sees #section.
    cy.request(`http://127.0.0.1:${port}/url-state/7?tag=x&tag=y`).then(
      (res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include(":7::x,y")
      }
    )

    cy.visit(`http://127.0.0.1:${port}/url-state/7?tag=x&tag=y#section`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="url-state"]').should("contain", "#section")
    cy.get('[data-testid="url-state"]').should("contain", "x,y")
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
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/guarded`)
    cy.location("pathname").should("eq", "/")
    cy.title().should("eq", "E2E SSR Home")
    cy.get('[data-testid="ssr-home"]').should("contain", "SSR e2e home")
    cy.contains("This page should be redirected away.").should("not.exist")
  })

  it("returns HTTP 403 from SSR middleware { error } (not redirect to login)", () => {
    const port = Cypress.expose("port")
    cy.request({
      url: `http://127.0.0.1:${port}/forbidden`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(403)
      expect(res.body).to.include("Forbidden")
      expect(res.headers.location).to.be.undefined
    })
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

  it("hydrates the hello route on full load", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/hello`)
    cy.get('[data-testid="ssr-loader"]').should(
      "contain",
      "Hello route (SSR + hydration smoke test)."
    )
  })

  it("renders scoped notFound route for unknown paths", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/missing-ssr-route`, {
      failOnStatusCode: false,
    })
    cy.get('[data-testid="ssr-not-found"]').should("contain", "SSR not found")
  })

  describe("SSR error pages", () => {
    it("renders scope error module when a matched route throws (500)", () => {
      const port = Cypress.expose("port")
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

    it("recovers via client navigation after SSR error page", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/`, { failOnStatusCode: true })
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('a[href="/nav-break"]').click()
      cy.get('[data-testid="ssr-error-page"]').should(
        "contain",
        "SSR error boundary: e2e-nav-boom"
      )
      cy.contains("nav a", "Home").click()
      cy.location("pathname").should("eq", "/")
      cy.get('[data-testid="ssr-home"]').should("exist")
      cy.get('[data-testid="ssr-error-page"]').should("not.exist")
    })

    it("uses leaf route error over scope error", () => {
      const port = Cypress.expose("port")
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

  describe("SEO and structured data", () => {
    it("includes JSON-LD in SSR HTML", () => {
      const port = Cypress.expose("port")
      cy.request(`http://127.0.0.1:${port}/`).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include("application/ld+json")
        expect(res.body).to.include("E2E SSR Home")
      })
    })

    it("renders the SEO demo route with document title", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/seo`)
      cy.title().should("eq", "E2E SSR SEO")
      cy.get('[data-testid="ssr-seo"]').should("exist")
    })
  })

  describe("document head on client navigation", () => {
    it("updates title when navigating between routes", () => {
      cy.title().should("eq", "E2E SSR Home")

      cy.contains("a", "SEO").click()
      cy.location("pathname").should("eq", "/seo")
      cy.get('[data-testid="ssr-seo"]').should("exist")
      cy.title().should("eq", "E2E SSR SEO")

      cy.contains("a", "Home").click()
      cy.location("pathname").should("eq", "/")
      cy.title().should("eq", "E2E SSR Home")
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

  it("applies query validation on SSR visit", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/search-schema?q=ok`)
    cy.get('[data-testid="search-schema"]').should("contain", "q=ok")
  })

  it("redirects to canonical query when defaults apply", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/search-schema`)
    cy.location("search").should("eq", "?q=default")
    cy.get('[data-testid="search-schema"]').should("contain", "q=default")
  })

  it("refetches serverLoader after invalidate on the current route", () => {
    const port = Cypress.expose("port")
    cy.intercept("POST", /\?action=/).as("formAction")
    cy.intercept("POST", /\?loader=/).as("serverLoader")
    cy.visit(`http://127.0.0.1:${port}/invalidate-demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="invalidate-generation"]').should("have.text", "0")
    cy.get('[data-testid="invalidate-bump"]').click()
    cy.wait("@formAction").its("response.statusCode").should("eq", 200)
    cy.wait("@serverLoader")
    cy.get('[data-testid="invalidate-generation"]').should("have.text", "1")
  })

  it("serves prerendered disk HTML for hybrid /docs without SSR-only home marker", () => {
    const port = Cypress.expose("port")
    cy.request(`http://127.0.0.1:${port}/docs`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include("Hybrid static docs")
      expect(res.body).not.to.include('data-testid="ssr-home"')
    })
  })

  it("isolates request context under many concurrent SSR requests", () => {
    const port = Cypress.expose("port")
    cy.task("concurrentContextCheck", { port, concurrency: 32 }).should(
      "deep.equal",
      { ok: true, concurrency: 32, origin: `http://127.0.0.1:${port}` }
    )
  })
})
