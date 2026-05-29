describe("debug forms reconcile", () => {
  it("checks form host hydration trace entries", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const sched = trace
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(sched).to.include(
        "phase=hydrate-host-enter type=form testid=forms-demo-form"
      )
      expect(sched).to.not.include("phase=template-hydrate-throw")
    })
  })
})
