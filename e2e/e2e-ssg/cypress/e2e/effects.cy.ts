// @ts-ignore
const expectedLogs = [
  "grandchild mounted - pre",
  "child mounted - pre",
  "child mounted - pre 2",
  "grandchild mounted - pre",
  "app mounted - pre",
  "grandchild mounted - post",
  "child mounted - post",
  "child mounted - post 2",
  "grandchild mounted - post",
  "app mounted - post",
]

describe("effects", () => {
  beforeEach(() => {
    const port = Cypress.env("port")
    // afterEach(() => cy.writeFile("src/Counter.tsx", counterTsx))
    cy.visit(`http://localhost:${port}/effects`)
  })

  it("fires effects in the right order", () => {
    cy.get("#output").should("have.text", expectedLogs.join("\n"))
  })
})
