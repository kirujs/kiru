describe("debug forms delay", () => {
  it("checks enhanced submit after short delay", () => {
    const port = Cypress.env("port")
    cy.intercept("POST", "/?action=forms.submitMessage").as("submitMessage")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.wait(1200)
    cy.get('[data-testid="forms-demo-submit"]').click()
    cy.wait("@submitMessage").its("request.headers").then((headers) => {
      expect(headers["x-kiru-form"]).to.eq("1")
    })
  })
})
