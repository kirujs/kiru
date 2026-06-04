describe("SSG i18n", () => {
  it("prerenders locale-specific HTML per public path", () => {
    cy.request("/about").then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include("Hello from the English bundle")
      expect(res.body).to.match(/<html[^>]*\slang="en"/i)
    })
    cy.request("/fr/about").then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.include("Bonjour depuis le bundle français")
      expect(res.body).to.match(/<html[^>]*\slang="fr"/i)
    })
  })

  it("hydrates locale-specific content after visit", () => {
    cy.visit("/about")
    cy.get('[data-testid="locale-code"]').should("have.text", "en")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Hello from the English bundle"
    )

    cy.visit("/fr/about")
    cy.get('[data-testid="locale-code"]').should("have.text", "fr")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Bonjour depuis le bundle français"
    )
  })

  it("switches locale with setLocale without full reload", () => {
    cy.visit("/about")
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
    cy.visit("/about")
    cy.get('[data-testid="locale-code"]').should("have.text", "en")
    cy.get('[data-testid="locale-link-fr"]')
      .should("have.attr", "href", "/fr/about")
      .click()
    cy.location("pathname").should("eq", "/fr/about")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Bonjour depuis le bundle français"
    )
  })
})
