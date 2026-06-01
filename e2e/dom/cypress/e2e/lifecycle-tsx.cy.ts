describe("dom runtime nested (tsx codegen)", () => {
  it("renders parent label and nested counter", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=nested-tsx`)

    cy.get('[data-testid="parent-value"]').should("have.text", "0")
    cy.get('[data-testid="child-counter"] .counter-value').should("have.text", "5")

    cy.get('[data-testid="parent-value"]').click()
    cy.get('[data-testid="parent-value"]').should("have.text", "1")

    cy.get('[data-testid="child-counter"] [data-testid="increment"]').click()
    cy.get('[data-testid="child-counter"] .counter-value').should("have.text", "6")
  })
})

describe("dom runtime swap (tsx codegen)", () => {
  it("swaps between counter and panel", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=swap-tsx`)

    cy.get('[data-testid="child-counter"]').should("be.visible")
    cy.get('[data-testid="panel"]').should("not.exist")

    cy.get('[data-testid="swap-btn"]').click()
    cy.get('[data-testid="panel"]').should("be.visible")
    cy.get('[data-testid="child-counter"]').should("not.exist")

    cy.get('[data-testid="panel-btn"]').click()
    cy.get(".panel-label").should("contain.text", "Panel (1)")

    cy.get('[data-testid="swap-btn"]').click()
    cy.get('[data-testid="child-counter"]').should("be.visible")
    cy.get(".counter-value").should("have.text", "0")
  })
})
