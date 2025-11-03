describe("rendering", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/counter`).wait(1000)
  })
  it("displays the correct text in the site heading", () => {
    cy.get("header h1").should("have.text", "Hello World")
  })
  it("correctly adds and removes attributes when an element is rerendered", () => {
    cy.get("main #counter span").should("have.attr", "data-even")
    cy.get("main #counter button").click()
    cy.get("main #counter span").should("have.attr", "data-odd")
    cy.get("main #counter span").should("not.have.attr", "data-even")
    cy.get("main #counter button").click()
    cy.get("main #counter span").should("have.attr", "data-even")
    cy.get("main #counter span").should("not.have.attr", "data-odd")
  })
  it("correctly transforms aria attributes", () => {
    cy.get("main #counter button").should("have.attr", "aria-label")
  })
})
