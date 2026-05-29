describe("debug refresh churn", () => {
  it("captures refresh phases around forms hydration", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const txt = (((w as any).__kiruHydrationTrace ?? []) as Array<any>)
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.include("phase=reconcile-template-holes type=section")
      expect(txt).to.include("holeCount=5")
      expect(txt).to.not.include("phase=template-hydrate-throw")
    })
  })
})
