describe("debug forms delay", () => {
  it("checks enhanced submit after short delay", () => {
    const port = Cypress.expose("port")
    cy.intercept("POST", /\?action=/).as("formAction")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.wait(1200)
    cy.get('[data-testid="forms-demo-submit"]').click()
    cy.wait("@formAction")
      .its("request.headers")
      .then((headers) => {
        expect(headers["x-kiru-form"]).to.eq("1")
      })
  })
})
