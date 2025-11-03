describe("basic reactivity & state", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/counter`).wait(1000)
  })

  it("updates text in the dom that was derived from state when the state changes", () => {
    cy.get("main #counter button").click().click().click()
    cy.get("main #counter span").should("have.text", "3")
  })

  it("can conditionaly render elements", () => {
    cy.get("main #counter p").should("not.exist")
    cy.get("main #counter button").click().click()
    cy.get("main #counter p").should("exist")
  })

  it("correctly persists component state when order of children changes", () => {
    cy.get("main #counter button").click().click()
    cy.get("main #toggle-btn").click()
    cy.get("main #counter span").should("have.text", "2")
  })
})

describe("hooks & data", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/todos`)
  })

  it("can render a dynamic state-driven list", () => {
    cy.get("main #todos ul").children().should("have.length", 3)
    cy.get("main #todos input").type("test")
    cy.get("main #todos button").click()
    cy.get("main #todos ul").children().should("have.length", 4)
  })

  it("can use two-way binding to sync an input with state", () => {
    cy.get("main #todos input").type("test")
    cy.get("main #todos button").click()
    cy.get("main #todos input").should("have.value", "")
  })
})
