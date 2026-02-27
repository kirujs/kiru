let counterTsx = "",
  counterModifiedTsx = ""

describe("hot module reload", () => {
  before(() =>
    cy.readFile("src/pages/counter/index.tsx").then((file) => {
      counterTsx = file
      counterModifiedTsx = counterTsx.replace(
        `<div id="counter">`,
        `<div id="counter" data-changed="true">`
      )
    })
  )
  beforeEach(() => {
    const port = Cypress.env("port")
    cy.visit(`http://localhost:${port}/counter`).wait(500)
  })
  afterEach(() =>
    cy.writeFile("src/pages/counter/index.tsx", counterTsx).wait(500)
  )

  it("can update a component in the VDOM & DOM after changing the file, without causing full refresh", () => {
    cy.get("#counter button").click() // set counter state to 1
    cy.window()
      .then((win) => {
        // @ts-expect-error
        win["test_marker"] = 123
      })
      .then(() =>
        cy
          .writeFile("src/pages/counter/index.tsx", counterModifiedTsx)
          .wait(500)
      )
      .then(() => cy.get("#counter").should("have.attr", "data-changed"))
      .then(() => cy.window().should("have.property", "test_marker"))
  })
})
