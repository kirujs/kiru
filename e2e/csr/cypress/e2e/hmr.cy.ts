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
    cy.visit(`http://localhost:${port}/counter`)
  })
  afterEach(() => cy.writeFile("src/pages/counter/index.tsx", counterTsx))

  it("can update a component in the VDOM & DOM after changing the file, without causing full refresh", () => {
    cy.window()
      .then((win) => {
        // @ts-expect-error
        win["test_marker"] = 123
      })
      .then(() =>
        cy.writeFile("src/pages/counter/index.tsx", counterModifiedTsx)
      )
      .then(() => cy.get("#counter").should("have.attr", "data-changed"))
      .then(() => cy.window().should("have.property", "test_marker"))
  })
  // we used to ensure that component state is persisted through HMR updates
  // but with the new api, this is no longer the case.
})
