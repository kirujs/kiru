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
})
