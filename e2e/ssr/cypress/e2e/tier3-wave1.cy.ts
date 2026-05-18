/**
 * Tier 3 wave 1: ISR, loader cache, i18n, assets, streaming.
 * Requires production build (`pnpm test` in e2e/ssr runs build + server).
 */
describe("Tier 3 wave 1", () => {
  const port = Cypress.env("port")

  describe("Hybrid ISR", () => {
    it("includes ISR sidecar metadata in the build output", () => {
      cy.readFile("dist/client/revalidate-demo.prerender-meta.json").then(
        (meta: { revalidate: number; tags: string[] }) => {
          expect(meta.revalidate).to.eq(1)
          expect(meta.tags).to.include("revalidate-demo")
        }
      )
    })

    it("serves prerendered HTML with ISR cache-control in production", () => {
      cy.request(`http://127.0.0.1:${port}/revalidate-demo`).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.headers["cache-control"]).to.match(/s-maxage=1/)
        expect(res.body).to.match(/revalidate-generation[^>]*>1</)
      })
    })

    it("revalidates after form action and serves updated generation", () => {
      cy.intercept("POST", /\?action=/).as("revalidateAction")
      cy.request(`http://127.0.0.1:${port}/revalidate-demo`).then((res) => {
        expect(res.body).to.match(/revalidate-generation[^>]*>1</)
      })
      cy.visit(`http://127.0.0.1:${port}/revalidate-demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="revalidate-generation"]').should("have.text", "1")
      cy.get('[data-testid="revalidate-bump"]').click()
      cy.wait("@revalidateAction").its("response.statusCode").should("eq", 200)
      cy.request(`http://127.0.0.1:${port}/revalidate-demo`).then((res) => {
        expect(res.body).to.match(/revalidate-generation[^>]*>2</)
      })
    })

  })

  describe("Loader cache", () => {
    it("reuses loader data on client navigation within staleTime", () => {
      type LoaderInterception = { request?: { url?: string } }
      const loaderCachePosts = (calls: LoaderInterception[]) =>
        calls.filter((call) =>
          String(call.request?.url ?? "").includes("loader-cache-demo")
        ).length

      cy.intercept("POST", /\?loader=/).as("loaderPost")
      cy.visit(`http://127.0.0.1:${port}/loader-cache-demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="loader-cache-count"]').then(($el) => {
        const cached = $el.text()
        cy.get<LoaderInterception[]>("@loaderPost.all").then((callsAfterVisit) => {
          const postsAfterVisit = loaderCachePosts(callsAfterVisit)
          cy.contains("a", "Home").click()
          cy.contains("a", "Loader cache").click()
          cy.get('[data-testid="loader-cache-count"]').should("have.text", cached)
          cy.get<LoaderInterception[]>("@loaderPost.all").then(
            (callsAfterRoundTrip) => {
              expect(loaderCachePosts(callsAfterRoundTrip)).to.eq(postsAfterVisit)
            }
          )
        })
      })
    })

    it("refetches loader data on full page reload", () => {
      cy.visit(`http://127.0.0.1:${port}/loader-cache-demo`)
      cy.get('[data-testid="loader-cache-count"]').then(($el) => {
        const before = $el.text()
        cy.reload()
        cy.get('[data-testid="loader-cache-count"]').should(($after) => {
          expect($after.text()).not.to.eq(before)
        })
      })
    })
  })

  describe("i18n", () => {
    it("renders locale-specific content on prefixed routes (SSR)", () => {
      cy.request(`http://127.0.0.1:${port}/about`).then((res) => {
        expect(res.body).to.include("Hello from the English bundle")
        expect(res.body).to.match(/<html[^>]*\slang="en"/i)
      })
      cy.request(`http://127.0.0.1:${port}/fr/about`).then((res) => {
        expect(res.body).to.include("Bonjour depuis le bundle français")
        expect(res.body).to.match(/<html[^>]*\slang="fr"/i)
      })
    })

    it("renders locale-specific content after client visit and hydration", () => {
      cy.visit(`http://127.0.0.1:${port}/about`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="locale-code"]').should("have.text", "en")
      cy.get('[data-testid="locale-title"]').should("contain", "About")
      cy.get('[data-testid="locale-greeting"]').should(
        "contain",
        "Hello from the English bundle"
      )

      cy.visit(`http://127.0.0.1:${port}/fr/about`)
      cy.get('[data-testid="locale-code"]').should("have.text", "fr")
      cy.get('[data-testid="locale-title"]').should("contain", "propos")
      cy.get('[data-testid="locale-greeting"]').should(
        "contain",
        "Bonjour depuis le bundle français"
      )
    })

    it("switches locale with setLocale without full reload", () => {
      cy.visit(`http://127.0.0.1:${port}/about`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="locale-greeting"]').should(
        "contain",
        "Hello from the English bundle"
      )
      cy.get('[data-testid="locale-switch-fr"]').click()
      cy.location("pathname").should("eq", "/fr/about")
      cy.get('[data-testid="locale-code"]').should("have.text", "fr")
      cy.get('[data-testid="locale-greeting"]').should(
        "contain",
        "Bonjour depuis le bundle français"
      )
    })

    it("switches locale via Link locale prop", () => {
      cy.visit(`http://127.0.0.1:${port}/about`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="locale-link-fr"]')
        .should("have.attr", "href", "/fr/about")
        .click()
      cy.location("pathname").should("eq", "/fr/about")
      cy.get('[data-testid="locale-greeting"]').should(
        "contain",
        "Bonjour depuis le bundle français"
      )
    })

    it("redirects unsupported locale prefix to default-locale URL", () => {
      cy.request({
        url: `http://127.0.0.1:${port}/de/about`,
        followRedirect: false,
      }).then((res) => {
        expect(res.status).to.eq(302)
        expect(res.headers.location).to.match(/\/about$/)
      })
    })

    it("redirects / to prefixed locale from Accept-Language", () => {
      cy.request({
        url: `http://127.0.0.1:${port}/`,
        followRedirect: false,
        headers: { "accept-language": "fr,en;q=0.9" },
      }).then((res) => {
        expect(res.status).to.eq(302)
        expect(res.headers.location).to.match(/\/fr\/?$/)
      })
    })

    it("server loader receives locale from URL", () => {
      cy.request(`http://127.0.0.1:${port}/fr/loaders/server`).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include('"pathname":"/loaders/server"')
        expect(res.body).to.include('"locale":"fr"')
        expect(res.body).to.include("#fr")
      })
    })
  })

  describe("Assets", () => {
    it("renders KiruImage with dimensions in SSR and CSR", () => {
      cy.request(`http://127.0.0.1:${port}/image-demo`).then((res) => {
        expect(res.body).to.match(/<img[^>]*width="32"[^>]*height="32"/)
      })
      cy.visit(`http://127.0.0.1:${port}/image-demo`)
      cy.get('[data-testid="image-demo"] img')
        .should("have.attr", "width", "32")
        .and("have.attr", "height", "32")
        .and("have.attr", "loading", "eager")
    })
  })

  describe("PPR-lite / ISR dynamic", () => {
    it("force-dynamic skips disk prerender and increments SSR loader hits", () => {
      cy.readFile("dist/client/ppr/force-dynamic.html").then((html) => {
        expect(String(html)).to.match(/ppr-force-dynamic-hit[^>]*>1</)
      })
      cy.request(`http://127.0.0.1:${port}/ppr/force-dynamic`).then((first) => {
        expect(first.status).to.eq(200)
        const hit1 = first.body.match(/ppr-force-dynamic-hit[^>]*>(\d+)</)?.[1]
        expect(hit1).to.eq("1")
        cy.request(`http://127.0.0.1:${port}/ppr/force-dynamic`).then((second) => {
          expect(second.status).to.eq(200)
          const hit2 = second.body.match(/ppr-force-dynamic-hit[^>]*>(\d+)</)?.[1]
          expect(Number(hit2)).to.be.greaterThan(Number(hit1))
        })
      })
    })

    it("force-static returns 404 when prerender HTML is missing", () => {
      cy.request({
        url: `http://127.0.0.1:${port}/ppr/force-static`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404)
      })
    })
  })

  describe("PPR-lite / streaming", () => {
    it("includes streaming shell markers for serverLoader + fallback route", () => {
      cy.request(`http://127.0.0.1:${port}/loaders/server-immediate-shell`).then(
        (res) => {
          expect(res.status).to.eq(200)
          expect(res.body).to.match(/server@|loader|streaming/i)
        }
      )
    })

    it("streams deferred loader data on streaming-test route", () => {
      cy.request(`http://127.0.0.1:${port}/streaming-test`).then((res) => {
        expect(res.status).to.eq(200)
        expect(res.body).to.include("streaming-test")
      })
    })
  })

  describe("Invalidation", () => {
    it("refetches serverLoader after invalidate on the current route", () => {
      cy.intercept("POST", /\?action=/).as("formAction")
      cy.intercept("POST", /\?loader=/).as("serverLoader")
      cy.visit(`http://127.0.0.1:${port}/invalidate-demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="invalidate-generation"]').then(($el) => {
        const before = $el.text()
        cy.get('[data-testid="invalidate-bump"]').click()
        cy.wait("@formAction").its("response.statusCode").should("eq", 200)
        cy.wait("@serverLoader")
        cy.get('[data-testid="invalidate-generation"]').should(($after) => {
          expect(Number($after.text())).to.be.greaterThan(Number(before))
        })
      })
    })
  })
})
