describe("dom runtime counter", () => {
  it("increments and decrements via signal bindings", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)

    cy.get('[data-testid="counter"]').should("be.visible")
    cy.get(".counter-value").should("have.text", "0")

    cy.get('[data-testid="increment"]').click()
    cy.get(".counter-value").should("have.text", "1")

    cy.get('[data-testid="increment"]').click()
    cy.get(".counter-value").should("have.text", "2")

    cy.get('[data-testid="decrement"]').click()
    cy.get(".counter-value").should("have.text", "1")
  })
})
