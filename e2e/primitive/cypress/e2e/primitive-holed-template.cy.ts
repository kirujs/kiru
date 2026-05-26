/**
 * Regression for sandbox/primitive: holed template parent with
 * [bind:input, Counter component] must mount both children (not markers-only shell).
 */
describe("primitive sandbox holed template", () => {
  const visitApp = () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  }

  beforeEach(visitApp)

  it("renders bind input and Counter content on load", () => {
    cy.get('[data-testid="app-root"] input[type="number"]')
      .should("be.visible")
      .and("have.value", "0")
    cy.get('[data-testid="counter-value"]').should("have.text", "Count: 0")
    cy.get('[data-testid="counter-items"]').should("have.text", "Items: [0,2,3]")
  })

  it("keeps both holed children in the DOM (not marker-only shell)", () => {
    cy.get('[data-testid="app-root"]').within(() => {
      cy.get('input[type="number"]').should("exist")
      cy.get('[data-testid="counter"]').should("exist")
      cy.get('[data-testid="counter-value"]').should("contain", "Count:")
    })
  })

  it("updates the bound initial count input", () => {
    cy.get('[data-testid="initial-count"]').clear().type("5")
    cy.get('[data-testid="initial-count"]').should("have.value", "5")
  })

  it("increments counter independently of initial input", () => {
    cy.get('[data-testid="counter-increment"]').click()
    cy.get('[data-testid="counter-value"]').should("have.text", "Count: 1")
    cy.get('[data-testid="counter-items"]').should("have.text", "Items: [0,2,3]")
  })

  it("orders input before counter in the holed shell", () => {
    cy.get('[data-testid="app-root"]').then(($root) => {
      const children = Array.from($root[0]!.childNodes)
      const inputIndex = children.findIndex(
        (n) => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "INPUT"
      )
      const counterIndex = children.findIndex(
        (n) =>
          n.nodeType === Node.ELEMENT_NODE &&
          (n as Element).getAttribute("data-testid") === "counter"
      )
      expect(inputIndex).to.be.greaterThan(-1)
      expect(counterIndex).to.be.greaterThan(inputIndex)
    })
  })
})
