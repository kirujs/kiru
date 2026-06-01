describe("dom runtime workspace (tsx codegen)", () => {
  function visitAndExpandSections() {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=workspace-tsx`)
    cy.get('[data-testid="section-toggle-2"]').click()
    cy.get('[data-testid="section-toggle-3"]').click()
  }

  it("renders section spacers, columns, and task badges", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=workspace-tsx`)

    cy.get(".section-spacer").should("have.length", 3)
    cy.get(".section-spacer").eq(0).should("have.text", "1")
    cy.get(".section-spacer").eq(1).should("have.text", "2")
    cy.get(".section-spacer").eq(2).should("have.text", "3")

    cy.get(".section-name").eq(0).should("have.text", "Alpha")
    cy.get(".section-name").eq(1).should("have.text", "Beta")
    cy.get(".section-name").eq(2).should("have.text", "Gamma")

    cy.get('[data-testid="workspace-inner"]')
      .children()
      .should("have.length", 3)

    cy.get('[data-section-id="1"] .task-badge').should("have.length", 2)
    cy.get('[data-section-id="2"] .task-panel').should("not.exist")
    cy.get('[data-section-id="3"] .task-panel').should("not.exist")
  })

  it("filters visible tasks by tab", () => {
    visitAndExpandSections()

    cy.get('[data-testid="filter-open"]').click()
    cy.get(".task-row").should("have.length", 3)
    cy.get('[data-testid="filter-open"]').should("have.class", "active")

    cy.get('[data-testid="filter-done"]').click()
    cy.get(".task-row").should("have.length", 2)
    cy.get('[data-testid="filter-done"]').should("have.class", "active")

    cy.get('[data-testid="filter-all"]').click()
    cy.get(".task-row").should("have.length", 5)
    cy.get('[data-testid="filter-all"]').should("have.class", "active")
  })

  it("collapses and expands a section task panel", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/?app=workspace-tsx`)

    cy.get('[data-section-id="1"] .task-panel').should("be.visible")
    cy.get('[data-section-id="1"] .section-toggle').click()
    cy.get('[data-section-id="1"] .task-panel').should("not.exist")

    cy.get('[data-section-id="1"] .section-toggle').click()
    cy.get('[data-section-id="1"] .task-panel').should("be.visible")
    cy.get('[data-section-id="1"] .task-row').should("have.length", 2)
  })

  it("reorders sections and updates spacer text", () => {
    visitAndExpandSections()

    cy.get('[data-section-id="1"] .section-move-down').click()

    cy.get(".section-spacer").eq(0).should("have.text", "2")
    cy.get(".section-spacer").eq(1).should("have.text", "1")
    cy.get(".section-name").eq(0).should("have.text", "Beta")
    cy.get(".section-name").eq(1).should("have.text", "Alpha")

    cy.get('[data-section-id="1"] .task-panel').should("be.visible")
    cy.get('[data-section-id="2"] .task-panel').should("be.visible")
    cy.get('[data-section-id="3"] .task-panel').should("be.visible")
  })

  it("preserves note count when reordering tasks within a section", () => {
    visitAndExpandSections()

    cy.get('[data-task-id="1"] .note-increment').click().click()
    cy.get('[data-task-id="2"] .note-increment').click()

    cy.get('[data-task-id="1"] .task-note-count').should("have.text", "2")
    cy.get('[data-task-id="2"] .task-note-count').should("have.text", "1")

    cy.get('[data-task-id="2"] .task-move-up').click()

    cy.get('[data-task-id="2"] .task-note-count').should("have.text", "1")
    cy.get('[data-task-id="1"] .task-note-count').should("have.text", "2")
  })

  it("moves a task to another section; note count resets on new For instance", () => {
    visitAndExpandSections()

    cy.get('[data-section-id="2"] .task-panel').should("be.visible")
    cy.get('[data-section-id="2"] [data-task-id="3"]').should("exist")
    cy.get('[data-section-id="2"] [data-task-id="3"] .note-increment')
      .click()
      .click()
      .click()
    cy.get('[data-task-id="3"] .task-note-count').should("have.text", "3")

    cy.get('[data-section-id="2"] [data-task-id="3"] .task-move-prev-section').click()

    cy.get('[data-section-id="2"] [data-task-id="3"]').should("not.exist")
    cy.get('[data-section-id="1"] .task-list [data-task-id="3"]').should("exist")
    cy.get('[data-section-id="1"] [data-task-id="3"] .task-note-count').should(
      "have.text",
      "0"
    )
    cy.get('[data-section-id="1"] .task-badge').contains("3")
  })

  it("shows nested empty fallback when filter leaves a section with no tasks", () => {
    visitAndExpandSections()

    cy.get('[data-testid="filter-done"]').click()
    cy.get('[data-section-id="2"] .task-panel').should("be.visible")
    cy.get('[data-section-id="2"] .task-empty').should("be.visible")
    cy.get('[data-section-id="1"] .task-row').should("have.length", 1)
    cy.get('[data-section-id="3"] .task-row').should("have.length", 1)
  })

  it("adds a task to a section", () => {
    visitAndExpandSections()

    cy.get('[data-section-id="1"] .task-input').type("New task")
    cy.get('[data-section-id="1"] .task-add').click()

    cy.get('[data-section-id="1"] .task-row').should("have.length", 3)
    cy.get('[data-section-id="1"] .task-text').last().should("have.text", "New task")
    cy.get('[data-section-id="1"] .task-badge').last().should("have.text", "10")
  })
})
