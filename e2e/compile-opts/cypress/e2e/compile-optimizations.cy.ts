describe("compile-time optimizations (staticHoisting + templates)", () => {
  const visitApp = () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  }

  describe("DOM templates", () => {
    beforeEach(visitApp)

    it("renders a fully static badge from a template clone", () => {
      cy.get('[data-testid="static-badge"]')
        .should("be.visible")
        .and("have.text", "OK")
        .and("have.class", "badge")
    })

    it("remounts the badge with a fresh DOM node after toggle", () => {
      cy.get('[data-testid="static-badge"]').then(($first) => {
        const first = $first[0]!
        cy.get('[data-testid="badge-toggle"]').click()
        cy.get('[data-testid="static-badge"]').should("not.exist")
        cy.get('[data-testid="badge-toggle"]').click()
        cy.get('[data-testid="static-badge"]')
          .should("be.visible")
          .and("have.text", "OK")
          .then(($second) => {
            expect($second[0]).not.to.eq(first)
          })
      })
    })
  })

  describe("static hoisting", () => {
    beforeEach(visitApp)

    it("keeps mixed static siblings while a dynamic slot updates", () => {
      cy.get('[data-testid="mixed-static-a"]').should("have.text", "static A")
      cy.get('[data-testid="mixed-static-b"]').should("have.text", "static B")
      cy.get('[data-testid="mixed-dynamic"]').should("have.text", "dynamic: 0")

      cy.get('[data-testid="mixed-increment"]').click()
      cy.get('[data-testid="mixed-dynamic"]').should("have.text", "dynamic: 1")
      cy.get('[data-testid="mixed-static-a"]').should("have.text", "static A")
      cy.get('[data-testid="mixed-static-b"]').should("have.text", "static B")

      cy.get('[data-testid="mixed-increment"]').click()
      cy.get('[data-testid="mixed-dynamic"]').should("have.text", "dynamic: 2")
      cy.get('[data-testid="mixed-static-a"]').should("have.text", "static A")
    })

    it("updates a hoisted dynamic counter and derived props", () => {
      cy.get('[data-testid="counter-value"]').should("have.text", "Count: 0")
      cy.get('[data-testid="counter-items"]').should(
        "have.text",
        "Items: [0,2,3]"
      )

      cy.get('[data-testid="counter-increment"]').click()
      cy.get('[data-testid="counter-value"]').should("have.text", "Count: 1")

      cy.get('[data-testid="count-input"]').clear().type("5")
      cy.get('[data-testid="counter-items"]').should(
        "have.text",
        "Items: [5,2,3]"
      )
      cy.get('[data-testid="counter-value"]').should("have.text", "Count: 5")
    })

    it("keeps multiple holed children mounted and ordered", () => {
      cy.get('[data-testid="two-hole-host"]').within(() => {
        cy.get('[data-testid="two-hole-input"]').should("exist")
        cy.get('[data-testid="two-hole-panel"]').should("have.text", "value: 0")
      })

      cy.get('[data-testid="two-hole-host"]').then(($host) => {
        const children = Array.from($host[0]!.childNodes)
        const inputIndex = children.findIndex(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE &&
            (n as Element).tagName === "INPUT"
        )
        const panelIndex = children.findIndex(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE &&
            (n as Element).getAttribute("data-testid") === "two-hole-panel"
        )
        expect(inputIndex).to.be.greaterThan(-1)
        expect(panelIndex).to.be.greaterThan(inputIndex)
      })

      cy.get('[data-testid="two-hole-input"]').clear().type("7")
      cy.get('[data-testid="two-hole-panel"]').should("have.text", "value: 7")
    })
  })
})
