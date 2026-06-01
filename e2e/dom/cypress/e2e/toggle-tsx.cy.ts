describe("dom runtime toggle (tsx codegen)", () => {
  it("shows and hides counter with teardown", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=toggle-tsx`)

    cy.get('[data-testid="toggle-app"]').should("be.visible")
    cy.get('[data-testid="child-counter"]').should("not.exist")

    cy.get('[data-testid="toggle-btn"]').click()
    cy.get('[data-testid="child-counter"]').should("be.visible")
    cy.get(".counter-value").should("have.text", "0")

    cy.get('[data-testid="increment"]').click()
    cy.get(".counter-value").should("have.text", "1")

    cy.get('[data-testid="toggle-btn"]').click()
    cy.get('[data-testid="child-counter"]').should("not.exist")

    cy.get('[data-testid="toggle-btn"]').click()
    cy.get('[data-testid="child-counter"]').should("be.visible")
    cy.get(".counter-value").should("have.text", "0")
  })
})
