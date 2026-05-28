describe("debug linked actions network", () => {
  it("records action RPC requests for literal and linked default exports", () => {
    const port = Cypress.env("port")
    cy.intercept("POST", "/?action=*").as("action")
    cy.visit(`http://127.0.0.1:${port}/default-export-demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")

    cy.get('[data-testid="literal-default-get"]').click()
    cy.wait("@action").its("request.url").should("include", "default.getEcho")
    cy.get('[data-testid="literal-default-result"]').should("contain", "echo:")

    cy.get('[data-testid="linked-default-get"]').click()
    cy.wait("@action").its("request.url").should("include", "default.getEcho")
    cy.get('[data-testid="linked-default-result"]').invoke("text").should("not.eq", "")
  })
})
