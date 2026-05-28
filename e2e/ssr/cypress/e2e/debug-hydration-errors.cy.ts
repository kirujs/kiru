describe("debug hydration errors", () => {
  it("shows hydration errors and active path on forms route", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const path = w.location.pathname
      const errs = ((w as any).__kiruHydrationErrors ?? []) as string[]
      expect(path).to.eq("/forms/demo")
      expect(errs, errs.join("\n")).to.have.length(0)
    })
  })
})
