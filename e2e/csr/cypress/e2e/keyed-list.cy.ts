describe("keyed list diffing", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/keyed-list`)
  })

  it("maintains component state when list items are reordered", () => {
    // Increment counters to different values
    cy.get('[data-id="1"] .increment').click().click() // Counter 1 = 2
    cy.get('[data-id="2"] .increment').click().click().click() // Counter 2 = 3
    cy.get('[data-id="3"] .increment').click() // Counter 3 = 1

    // Verify initial state
    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    // Move item 2 down (swap with item 3)
    cy.get(".list-item:nth-child(2) .move-down").click()

    // Verify state is maintained after reorder
    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")

    // Verify DOM order changed
    cy.get(".list-item:nth-child(1) [data-id]").should(
      "have.attr",
      "data-id",
      "1"
    )
    cy.get(".list-item:nth-child(2) [data-id]").should(
      "have.attr",
      "data-id",
      "3"
    )
    cy.get(".list-item:nth-child(3) [data-id]").should(
      "have.attr",
      "data-id",
      "2"
    )
  })

  it("maintains component state when moving items up", () => {
    // Set different counter values
    cy.get('[data-id="1"] .increment').click()
    cy.get('[data-id="2"] .increment').click().click()
    cy.get('[data-id="3"] .increment').click().click().click()

    // Move item 3 up twice to position 1
    cy.get(".list-item:nth-child(3) .move-up").click()
    cy.get(".list-item:nth-child(2) .move-up").click()

    // Verify state persisted
    cy.get('[data-id="3"] .counter-value').should("have.text", "3")
    cy.get('[data-id="1"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "2")

    // Verify new order
    cy.get(".list-item:nth-child(1) [data-id]").should(
      "have.attr",
      "data-id",
      "3"
    )
    cy.get(".list-item:nth-child(2) [data-id]").should(
      "have.attr",
      "data-id",
      "1"
    )
    cy.get(".list-item:nth-child(3) [data-id]").should(
      "have.attr",
      "data-id",
      "2"
    )
  })

  it("maintains independent state for each counter component", () => {
    // Increment and decrement different counters
    cy.get('[data-id="1"] .increment').click().click().click()
    cy.get('[data-id="2"] .decrement').click()
    cy.get('[data-id="3"] .increment').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    // Shuffle the list
    cy.get(".list-item:nth-child(1) .move-down").click()
    cy.get(".list-item:nth-child(3) .move-up").click()

    // State should still be correct
    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
  })
})
