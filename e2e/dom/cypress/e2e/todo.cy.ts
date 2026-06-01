describe("dom runtime todo", () => {
  it("adds and deletes todos", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=todo`)

    cy.get('[data-testid="todo-count"]').should("have.text", "0 items")

    cy.get('[data-testid="todo-input"]').type("Buy milk")
    cy.get('[data-testid="todo-add"]').click()
    cy.get('[data-testid="todo-count"]').should("have.text", "1 items")
    cy.get(".todo-text").should("have.text", "Buy milk")

    cy.get('[data-testid="todo-input"]').type("Walk dog")
    cy.get('[data-testid="todo-add"]').click()
    cy.get('[data-testid="todo-count"]').should("have.text", "2 items")
    cy.get(".todo-row").should("have.length", 2)

    cy.get(".todo-row").first().find(".todo-delete").click()
    cy.get('[data-testid="todo-count"]').should("have.text", "1 items")
    cy.get(".todo-text").should("have.text", "Walk dog")
  })

  it("toggles todo done state", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=todo`)

    cy.get('[data-testid="todo-input"]').type("Task")
    cy.get('[data-testid="todo-add"]').click()
    cy.get(".todo-done").should("not.be.checked")
    cy.get(".todo-done").check()
    cy.get(".todo-done").should("be.checked")
  })
})
