describe("dom runtime inbox (tsx codegen)", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=inbox-tsx`)
  })

  it("adds items and shows empty state when cleared", () => {
    cy.get('[data-testid="inbox-empty"]').should("be.visible")

    cy.get('[data-testid="inbox-input"]').type("First")
    cy.get('[data-testid="inbox-add"]').click()
    cy.get('[data-testid="inbox-empty"]').should("not.exist")
    cy.get(".inbox-row").should("have.length", 1)
    cy.get(".inbox-text").should("have.text", "First")

    cy.get('[data-testid="inbox-input"]').type("Second")
    cy.get('[data-testid="inbox-add"]').click()
    cy.get(".inbox-row").should("have.length", 2)
  })

  it("filters visible rows by tab", () => {
    cy.get('[data-testid="inbox-input"]').type("Active task")
    cy.get('[data-testid="inbox-add"]').click()
    cy.get('[data-testid="inbox-input"]').type("Done task")
    cy.get('[data-testid="inbox-add"]').click()

    cy.get(".inbox-row").last().find(".inbox-done").check()

    cy.get('[data-testid="filter-active"]').click()
    cy.get(".inbox-row").should("have.length", 1)
    cy.get(".inbox-text").should("have.text", "Active task")

    cy.get('[data-testid="filter-done"]').click()
    cy.get(".inbox-row").should("have.length", 1)
    cy.get(".inbox-text").should("have.text", "Done task")

    cy.get('[data-testid="filter-all"]').click()
    cy.get(".inbox-row").should("have.length", 2)
  })

  it("marks done, deletes, and archives items", () => {
    cy.get('[data-testid="inbox-input"]').type("Keep me")
    cy.get('[data-testid="inbox-add"]').click()
    cy.get('[data-testid="inbox-input"]').type("Remove me")
    cy.get('[data-testid="inbox-add"]').click()

    cy.get(".inbox-row").first().find(".inbox-done").check()
    cy.get(".inbox-row").first().find(".inbox-done").should("be.checked")

    cy.get(".inbox-row").last().find(".inbox-delete").click()
    cy.get(".inbox-row").should("have.length", 1)
    cy.get(".inbox-text").should("have.text", "Keep me")

    cy.get(".inbox-row").find(".inbox-archive").click()
    cy.get(".inbox-row").should("have.length", 0)
    cy.get('[data-testid="inbox-empty"]').should("be.visible")
  })
})
