describe("debug forms hole reconcile", () => {
  it("records section hole reconciliation and form child creation", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const lines = trace
        .filter((e) => typeof e?.action === "string")
        .map((e) => `${String(e.action)} ${String(e.vnode ?? "")} ${String(e.note ?? "")}`)
        .join("\n")

      expect(lines).to.include(
        "reconcileTemplateHoles section[data-testid=forms-demo] holeCount=5"
      )
      expect(lines).to.include("createChild form[data-testid=forms-demo-form]")
    })
  })
})
