describe("CSR i18n", () => {
  const port = Cypress.expose("port")
  const origin = () => `http://localhost:${port}`

  it("renders locale-specific content per URL prefix", () => {
    cy.visit(`${origin()}/about`)
    cy.get('[data-testid="locale-code"]').should("have.text", "en")
    cy.get('[data-testid="locale-title"]').should("contain", "About")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Hello from the English bundle"
    )

    cy.visit(`${origin()}/fr/about`)
    cy.get('[data-testid="locale-code"]').should("have.text", "fr")
    cy.get('[data-testid="locale-title"]').should("contain", "propos")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Bonjour depuis le bundle français"
    )
  })

  it("switches locale with setLocale without full reload", () => {
    cy.visit(`${origin()}/about`)
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
    cy.visit(`${origin()}/about`)
    cy.get('[data-testid="locale-link-fr"]').click()
    cy.location("pathname").should("eq", "/fr/about")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Bonjour depuis le bundle français"
    )
  })

  it("redirects unsupported locale prefix to default-locale URL", () => {
    cy.visit(`${origin()}/de/about`, { failOnStatusCode: false })
    cy.location("pathname").should("eq", "/about")
    cy.get('[data-testid="locale-greeting"]').should(
      "contain",
      "Hello from the English bundle"
    )
  })
})
