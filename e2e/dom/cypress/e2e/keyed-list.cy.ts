describe("dom runtime keyed list", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=keyed-list`)
  })

  it("maintains component state when list items are reordered", () => {
    cy.get('[data-id="1"] .increment').click().click()
    cy.get('[data-id="2"] .increment').click().click().click()
    cy.get('[data-id="3"] .increment').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    cy.get(".list-item:nth-child(2) .move-down").click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")

    cy.get(".list-item:nth-child(1) [data-id]").should("have.attr", "data-id", "1")
    cy.get(".list-item:nth-child(2) [data-id]").should("have.attr", "data-id", "3")
    cy.get(".list-item:nth-child(3) [data-id]").should("have.attr", "data-id", "2")
  })

  it("maintains component state when moving items up", () => {
    cy.get('[data-id="1"] .increment').click()
    cy.get('[data-id="2"] .increment').click().click()
    cy.get('[data-id="3"] .increment').click().click().click()

    cy.get(".list-item:nth-child(3) .move-up").click()
    cy.get(".list-item:nth-child(2) .move-up").click()

    cy.get('[data-id="3"] .counter-value').should("have.text", "3")
    cy.get('[data-id="1"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "2")

    cy.get(".list-item:nth-child(1) [data-id]").should("have.attr", "data-id", "3")
    cy.get(".list-item:nth-child(2) [data-id]").should("have.attr", "data-id", "1")
    cy.get(".list-item:nth-child(3) [data-id]").should("have.attr", "data-id", "2")
  })

  it("maintains independent state for each counter component", () => {
    cy.get('[data-id="1"] .increment').click().click().click()
    cy.get('[data-id="2"] .decrement').click()
    cy.get('[data-id="3"] .increment').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    cy.get(".list-item:nth-child(1) .move-down").click()
    cy.get(".list-item:nth-child(3) .move-up").click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
  })
})
