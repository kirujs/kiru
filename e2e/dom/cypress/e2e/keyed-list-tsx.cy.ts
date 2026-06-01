describe("dom runtime keyed list (tsx codegen)", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=keyed-list-tsx`)
  })

  it("renders fragment spacer and list-item siblings per row", () => {
    cy.get(".list-spacer").should("have.length", 3)
    cy.get(".list-item").should("have.length", 3)
    cy.get(".list-spacer").eq(0).should("have.text", "1")
    cy.get(".list-spacer").eq(1).should("have.text", "2")
    cy.get(".list-spacer").eq(2).should("have.text", "3")
    cy.get(".keyed-list-inner")
      .children()
      .should("have.length", 6)
  })

  it("maintains component state when list items are reordered", () => {
    cy.get('[data-id="1"] .increment').click().click()
    cy.get('[data-id="2"] .increment').click().click().click()
    cy.get('[data-id="3"] .increment').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    cy.get('[data-row-id="2"] .move-down').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "2")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "3")

    cy.get(".list-item").eq(0).should("have.attr", "data-row-id", "1")
    cy.get(".list-item").eq(1).should("have.attr", "data-row-id", "3")
    cy.get(".list-item").eq(2).should("have.attr", "data-row-id", "2")
    cy.get(".list-spacer").eq(0).should("have.text", "1")
    cy.get(".list-spacer").eq(1).should("have.text", "3")
    cy.get(".list-spacer").eq(2).should("have.text", "2")
  })

  it("maintains component state when moving items up", () => {
    cy.get('[data-id="1"] .increment').click()
    cy.get('[data-id="2"] .increment').click().click()
    cy.get('[data-id="3"] .increment').click().click().click()

    cy.get('[data-row-id="3"] .move-up').click()
    cy.get(".list-item").eq(1).find(".move-up").click()

    cy.get('[data-id="3"] .counter-value').should("have.text", "3")
    cy.get('[data-id="1"] .counter-value').should("have.text", "1")
    cy.get('[data-id="2"] .counter-value').should("have.text", "2")

    cy.get(".list-item").eq(0).should("have.attr", "data-row-id", "3")
    cy.get(".list-item").eq(1).should("have.attr", "data-row-id", "1")
    cy.get(".list-item").eq(2).should("have.attr", "data-row-id", "2")
  })

  it("maintains independent state for each counter component", () => {
    cy.get('[data-id="1"] .increment').click().click().click()
    cy.get('[data-id="2"] .decrement').click()
    cy.get('[data-id="3"] .increment').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")

    cy.get('[data-row-id="1"] .move-down').click()
    cy.get('[data-row-id="3"] .move-up').click()

    cy.get('[data-id="1"] .counter-value').should("have.text", "3")
    cy.get('[data-id="2"] .counter-value').should("have.text", "-1")
    cy.get('[data-id="3"] .counter-value').should("have.text", "1")
  })
})
