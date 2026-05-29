describe("debug forms host enter", () => {
  it("records form host hydration entry", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const txt = trace
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.not.include("phase=template-hydrate-throw")
    })
  })
})
