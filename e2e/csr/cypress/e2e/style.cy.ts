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

  it("applies CSS custom properties (variables) from style object", () => {
    cy.get("[data-css-var-target]").then(($el) => {
      const style = $el[0].style as CSSStyleDeclaration
      expect(style.getPropertyValue("--my-style").trim()).to.eq("12px")
      expect(style.getPropertyValue("--another-var").trim()).to.eq("2rem")
    })
  })

  it("updates style when a signal inside the style object changes", () => {
    cy.get("[data-style-signal-target]").should(
      "have.css",
      "color",
      "rgb(255, 0, 0)"
    )
    cy.get("[data-style-signal-toggle]").click()
    cy.get("[data-style-signal-target]").should(
      "have.css",
      "color",
      "rgb(0, 0, 255)"
    )
    cy.get("[data-style-signal-toggle]").click()
    cy.get("[data-style-signal-target]").should(
      "have.css",
      "color",
      "rgb(255, 0, 0)"
    )
  })
})
