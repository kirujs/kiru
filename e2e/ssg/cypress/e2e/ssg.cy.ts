describe("SSG build", () => {
  it("serves prerendered HTML with route meta and hydrates", () => {
    cy.visit("/")
    cy.title().should("eq", "E2E SSG Home")
    cy.get('[data-testid="ssg-home"]').should("contain", "SSG e2e home")
    cy.get('[data-testid="ssg-layout"]').should("exist")
  })

  it("serves prerendered static routes", () => {
    cy.visit("/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })

  it("includes dynamic route params in prerendered post pages", () => {
    cy.visit("/posts/one")
    cy.get('[data-testid="ssg-post"]').should("contain", "one")
    cy.get('[data-testid="ssg-loader"]').should("contain", "post:one")
  })

  it("embeds staticLoader data in prerendered HTML", () => {
    cy.visit("/loaders/static")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "static:prerendered loader data"
    )
  })

  it("serves staticLoader data on client navigation", () => {
    cy.visit("/")
    cy.get('[data-testid="ssg-home"]').should("exist")
    cy.contains("a", "Static loader").click()
    cy.location("pathname").should("eq", "/loaders/static")
    cy.get('[data-testid="loader-data"]').should(
      "contain",
      "static:prerendered loader data"
    )
  })

  it("prerenders nested static params from parent generateStaticParams", () => {
    cy.visit("/posts/one/comments/one-c1")
    cy.get('[data-testid="comment"]').should("contain", "one:one-c1")
  })

  it("serves static 404.html for unknown paths", () => {
    cy.request({
      url: "/does-not-exist",
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(404)
      expect(res.body).to.include("ssg-not-found")
    })
  })

  it("serves sitemap.xml generated from static paths", () => {
    cy.request("/sitemap.xml").then((res) => {
      expect(res.status).to.eq(200)
      expect(res.headers["content-type"]).to.match(/xml/i)
      expect(res.body).to.include("https://e2e-ssg.example/")
      expect(res.body).to.include("/posts/one")
      expect(res.body).to.include("/posts/one/comments/one-c1")
    })
  })

  it("serves robots.txt referencing the sitemap", () => {
    cy.request("/robots.txt").then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include(
        "Sitemap: https://e2e-ssg.example/sitemap.xml"
      )
    })
  })

  it("includes JSON-LD in prerendered document head", () => {
    cy.visit("/")
    cy.get('script[type="application/ld+json"]')
      .should("have.length.at.least", 1)
      .first()
      .invoke("text")
      .then((text) => {
        const data = JSON.parse(text)
        expect(data["@type"]).to.eq("WebPage")
        expect(data.name).to.eq("E2E SSG Home")
      })
  })

  it("serves the SEO demo page with structured data", () => {
    cy.visit("/seo")
    cy.title().should("eq", "E2E SSG SEO")
    cy.get('[data-testid="ssg-seo"]').should("exist")
    cy.get('script[type="application/ld+json"]').should("exist")
  })

  it("supports browser history between prerendered routes", () => {
    cy.visit("/")
    cy.visit("/about")
    cy.location("pathname").should("eq", "/about")
    cy.go("back")
    cy.location("pathname").should("eq", "/")
    cy.go("forward")
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="ssg-about"]').should("exist")
  })

  it("preserves hash after SSG hydration", () => {
    cy.visit("/hash-section#section")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="ssg-hash"]').should("contain", "#section")
    cy.get("#section").should("exist")
  })

  it("shows middleware { error: 403 } on client navigation after hydrate", () => {
    cy.visit("/")
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.contains("a", "Forbidden").click()
    cy.location("pathname").should("eq", "/forbidden")
    cy.get('[data-testid="ssg-error-page"]').should("contain", "Forbidden")
    cy.get('[data-testid="ssg-forbidden-page"]').should("not.exist")
  })
})
