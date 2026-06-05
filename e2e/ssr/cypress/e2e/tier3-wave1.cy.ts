/**
 * Tier 3 wave 1: ISR, loader cache, i18n, assets, streaming.
 * Requires production build (`pnpm test` in e2e/ssr runs build + server).
 */
describe("Tier 3 wave 1", () => {
  const port = Cypress.env("port")

  describe("Hydration module prewarm", () => {
    it("includes route modulepreload links on first paint", () => {
      cy.visit(`http://127.0.0.1:${port}/`)
      cy.get('head link[rel="modulepreload"]')
        .should("have.length.at.least", 1)
        .first()
        .should("have.attr", "href")
        .and("match", /^\/assets\/.+\.js$/)
    })

    it("injects modulepreload links for target route on link hover", () => {
      cy.visit(`http://127.0.0.1:${port}/`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('head link[rel="modulepreload"]').then(($links) => {
        const before = $links.length
        cy.contains("a", "About").trigger("pointerenter", { bubbles: true })
        cy.get('head link[rel="modulepreload"]').should(
          "have.length.at.least",
          before + 1
        )
      })
    })
  })

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
      cy.intercept("POST", /\?mutation=/).as("revalidateAction")
      cy.request(`http://127.0.0.1:${port}/revalidate-demo`).then((res) => {
        expect(res.body).to.match(/revalidate-generation[^>]*>1</)
      })
      cy.visit(`http://127.0.0.1:${port}/revalidate-demo`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
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
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
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
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
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
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
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
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
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

  describe("Query dedup / $$ref hydration", () => {
    it("serves canonical k-data and cache-key $$ref without duplicate payloads", () => {
      cy.task<string>(
        "fetchHtml",
        `http://127.0.0.1:${port}/query-dedup-demo`
      ).then((body) => {
        expect(body).to.include("query-dedup-demo")
        expect(body).to.include("hot-1")
        expect(body).to.include("new-1")
        expect(body).to.include("k-page-data")
        expect(body).to.include('"$$ref":')
        expect(body).to.include('"hotPosts":{')
        expect(body).to.include('"newPosts":{')
        expect(body).not.to.include("hot-resource-fallback")
        const kDataCount = (body.match(/k-data="/g) ?? []).length
        expect(kDataCount).to.eq(2)
        const pageDataRaw = body.match(
          /<script type="application\/json" k-page-data>([^<]+)/
        )?.[1]
        expect(pageDataRaw).to.be.a("string")
        const pageData = JSON.parse(pageDataRaw!) as {
          hotPosts: { $$ref: string }
          newPosts: { $$ref: string }
        }
        expect(pageData.hotPosts.$$ref).to.match(/^k:q:/)
        expect(pageData.newPosts.$$ref).to.match(/^k:q:/)
        expect(pageData.hotPosts.$$ref).not.to.eq(pageData.newPosts.$$ref)
        const streamTail = body.split("__$k_data").slice(1).join("__$k_data")
        if (streamTail.length > 0) {
          expect(streamTail).to.include(
            `"$$ref":"${pageData.hotPosts.$$ref}"`,
            "resource stream $$ref should match loader hotPosts k-data wire ref"
          )
        }
      })
    })

    it("mirrors Threadboard feed hydration: late stream k-data + hydrate", () => {
      cy.task<string>(
        "fetchHtml",
        `http://127.0.0.1:${port}/feed-hydration-demo`
      ).then((body) => {
        expect(body).to.include("feed-hydration-demo")
        expect(body).to.include("hot post one")
        expect(body).not.to.include("feed-fallback")
        expect(body).to.include("k-page-data")
        expect(body).to.include('"posts":{')
        expect(body).to.include('"$$ref":')

        const pageDataRaw = body.match(
          /<script type="application\/json" k-page-data>([^<]+)/
        )?.[1]
        expect(pageDataRaw).to.be.a("string")
        const pageData = JSON.parse(pageDataRaw!) as {
          posts: { $$ref: string }
        }
        const feedWireRef = pageData.posts.$$ref
        expect(feedWireRef).to.match(/^k:q:/)
        expect(body).to.include(`k-data="${feedWireRef}"`)

        const afterHtml = body.split("</html>")[1] ?? ""
        expect(afterHtml).to.include('k-data="k:q:')
        expect(afterHtml).to.include("__$k_data")
        const streamRefMatch = afterHtml.match(
          /__\$k_data\("[^"]+",\{"data":\{"\$\$ref":"(k:q:[^"]+)"\}\}\)/
        )
        expect(streamRefMatch?.[1]).to.be.a("string")
        expect(streamRefMatch![1]).not.to.eq(
          feedWireRef,
          "stream $$ref should be a late-registered query, not the loader feed ref"
        )
        expect(afterHtml).to.include(
          `k-data="${streamRefMatch![1]}"`,
          "late k-data script should precede matching stream $$ref"
        )
      })

      cy.visit(`http://127.0.0.1:${port}/feed-hydration-demo`)
      cy.get("#app", { timeout: 10_000 }).should(
        "have.attr",
        "data-kiru-hydrated-at"
      )
      cy.get("#app").invoke("text").should("have.length.gt", 20)
      cy.get('[data-testid="feed-hydration-demo"]', { timeout: 10_000 }).should(
        "exist"
      )
      cy.get('[data-testid="feed-post-hot-post-1"]', { timeout: 10_000 }).should(
        "contain",
        "hot post one"
      )
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "contain",
        "c/kiru"
      )
      cy.get('[data-testid="feed-fallback"]').should("not.exist")
      cy.get('[data-testid="communities-fallback"]').should("not.exist")
    })

    it("hydrates scoped Threadboard layout + feed without wiping #app", () => {
      cy.task<string>(
        "fetchHtml",
        `http://127.0.0.1:${port}/threadboard`
      ).then((body) => {
        expect(body).to.include("threadboard-home")
        expect(body).to.include("threadboard-layout")
        expect(body).to.include("How does query cache seeding work")
        expect(body).not.to.include("feed-fallback")
        expect(body).to.include("communities-fallback")
        expect(body).to.include("k-page-data")
        expect(body).to.include('"posts":{')
        expect(body).to.include('"$$ref":')

        const pageDataRaw = body.match(
          /<script type="application\/json" k-page-data>([^<]+)/
        )?.[1]
        expect(pageDataRaw).to.be.a("string")
        const pageData = JSON.parse(pageDataRaw!) as {
          posts: { $$ref: string }
        }
        const feedWireRef = pageData.posts.$$ref
        expect(feedWireRef).to.match(/^k:q:/)
        expect(body).to.include(`k-data="${feedWireRef}"`)

        const afterHtml = body.split("</html>")[1] ?? ""
        expect(afterHtml).to.include('k-data="k:q:')
        expect(afterHtml).to.include("__$k_data")
        const streamRefMatch = afterHtml.match(
          /__\$k_data\("[^"]+",\{"data":\{"\$\$ref":"(k:q:[^"]+)"\}\}\)/
        )
        expect(streamRefMatch?.[1]).to.be.a("string")
        expect(streamRefMatch![1]).not.to.eq(
          feedWireRef,
          "stream $$ref should be layout communities, not the loader feed ref"
        )
        expect(afterHtml).to.include(
          `k-data="${streamRefMatch![1]}"`,
          "late k-data script should precede matching stream $$ref"
        )
      })

      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.window().its("__kiruAppWiped").should("eq", false)
      cy.get("#app", { timeout: 10_000 }).should(
        "have.attr",
        "data-kiru-hydrated-at"
      )
      cy.get("#app").children().should("have.length.at.least", 1)
      cy.get('[data-testid="threadboard-layout"]', { timeout: 10_000 }).should(
        "exist"
      )
      cy.get('[data-testid="threadboard-home"]', { timeout: 10_000 }).should(
        "exist"
      )
      cy.get('[data-testid="feed-post-p-1"]', { timeout: 10_000 }).should(
        "contain",
        "How does query cache seeding work"
      )
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "contain",
        "c/kiru"
      )
      cy.get('[data-testid="feed-fallback"]').should("not.exist")
      cy.get('[data-testid="communities-fallback"]').should("not.exist")
      cy.window().then((w) => {
        const trace = w.__kiruBootstrapTrace ?? []
        const errors = trace.filter(
          (e: { event: string }) =>
            e.event.includes("error") || e.event === "mutation:empty"
        )
        expect(errors, JSON.stringify(trace, null, 2)).to.have.length(0)
      })
    })

    it("hydrates loader and resource lists without white screen", () => {
      cy.intercept("POST", /\?loader=/).as("loaderPost")
      cy.visit(`http://127.0.0.1:${port}/query-dedup-demo`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('[data-testid="hot-loader-hot-1"]').should("contain", "hot-1")
      cy.get('[data-testid="new-loader-new-1"]').should("contain", "new-1")
      cy.get('[data-testid="hot-resource-hot"]').should("contain", "hot-1")
      cy.get('[data-testid="query-dedup-demo"]').should("exist")
      cy.contains("a", "Home").click()
      cy.contains("a", "Query dedup").click()
      cy.wait("@loaderPost", { timeout: 10_000 })
        .its("response.statusCode")
        .should("eq", 200)
      cy.get('[data-testid="hot-loader-hot-1"]').should("contain", "hot-1")
      cy.get('[data-testid="new-loader-new-1"]').should("contain", "new-1")
    })
  })

  describe("Invalidation", () => {
    it("patches counter query from form without refetching serverLoader", () => {
      cy.intercept("POST", /\?mutation=/).as("formMutation")
      cy.visit(`http://127.0.0.1:${port}/invalidate-demo`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('[data-testid="invalidate-generation"]').should("have.text", "0")
      cy.get('[data-testid="invalidate-counter"]').should("have.text", "0")
      cy.get('[data-testid="invalidate-bump"]').click()
      cy.wait("@formMutation").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="invalidate-counter"]').should("have.text", "1")
      cy.get('[data-testid="invalidate-generation"]').should("have.text", "0")
    })
  })
})
