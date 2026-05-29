function dumpDiagOnLoaderFailure(label: string, interceptions?: unknown): void {
  if (!Cypress.expose("e2eDiag")) return
  cy.window().then((win) => {
    const w = win as typeof win & {
      dumpKiruDiagnostics?: () => Record<string, unknown>
    }
    const diag = w.dumpKiruDiagnostics?.() ?? { rpcTrace: [] }
    return cy.task("e2eDiag", {
      kind: "loader_assert_fail",
      label,
      interceptions,
      hydratedAt: (win as typeof win & { __kiruHydratedAt?: number })
        .__kiruHydratedAt,
      rpcTrace: diag.rpcTrace,
      loaderCacheSnapshot: diag.loaderCacheSnapshot,
    })
  })
}

describe("SSR server", () => {
  afterEach(function () {
    if (this.currentTest?.state !== "failed" || !Cypress.expose("e2eDiag"))
      return
    dumpDiagOnLoaderFailure(this.currentTest?.title ?? "unknown")
  })

  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("prefetches server loader data on link hover before navigation", () => {
    type LoaderInterception = { request?: { body?: unknown } }

    const serverLoaderPostCount = (interceptions: LoaderInterception[]) =>
      interceptions.filter((i) => {
        const raw = i.request?.body
        let ctx: { url?: { pathname?: string } } | null = null
        try {
          ctx =
            typeof raw === "string"
              ? (JSON.parse(raw) as { url?: { pathname?: string } })
              : raw && typeof raw === "object"
              ? (raw as { url?: { pathname?: string } })
              : null
        } catch {
          return false
        }
        const pathname = ctx?.url?.pathname
        if (
          pathname === "/loaders/server" ||
          pathname?.endsWith("/loaders/server") === true
        ) {
          return true
        }
        const serialized =
          typeof raw === "string" ? raw : JSON.stringify(raw ?? "")
        return (
          serialized.includes("/loaders/server") &&
          !serialized.includes("immediate-shell")
        )
      }).length

    cy.intercept("POST", /\?loader=/).as("loaderPost")

    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('a[href="/loaders/server"]')
      .first()
      .scrollIntoView()
      .trigger("pointerenter", { bubbles: true })

    cy.wait("@loaderPost")
    cy.get<LoaderInterception[]>("@loaderPost.all").should((interceptions) => {
      expect(serverLoaderPostCount(interceptions)).to.eq(1)
    })

    cy.get('a[href="/loaders/server"]').first().click()
    cy.location("pathname").should("eq", "/loaders/server")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "server@/loaders/server"
    )
    cy.get<LoaderInterception[]>("@loaderPost.all").should((interceptions) => {
      expect(serverLoaderPostCount(interceptions)).to.eq(1)
    })
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
    const port = Cypress.expose("port")
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

  describe("server loader immediate shell", () => {
    /** Must exceed i18n preload + hydrate on CI (observed ~1.35s before loader was 1.2s). */
    const LOADER_DELAY_MS = 2000
    const SHELL_BUDGET_MS = 600

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
      visitImmediateShellPage(Cypress.expose("port"))

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
      visitImmediateShellPage(Cypress.expose("port"))

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
            `hydration must finish before the ${LOADER_DELAY_MS}ms loader resolves — ${tag}`
          ).to.be.lessThan(LOADER_DELAY_MS)
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
      const port = Cypress.expose("port")
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
})
