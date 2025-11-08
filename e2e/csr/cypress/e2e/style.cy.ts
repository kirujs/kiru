describe("styles", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    // afterEach(() => cy.writeFile("src/Counter.tsx", counterTsx))
    cy.visit(`http://localhost:${port}/style`)
  })

  it("after randomizing style prop, element attr should have correct value", () => {
    Cypress._.times(128, () => {
      cy.get("[data-style-test-target]").click().should("have.text", "✅")
    })
  })
})
