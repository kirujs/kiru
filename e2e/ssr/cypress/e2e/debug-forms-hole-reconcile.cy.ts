describe("debug forms hole reconcile", () => {
  it("records section hole reconciliation and form host hydration", () => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const reconcile = trace
        .filter((e) => typeof e?.action === "string")
        .map(
          (e) =>
            `${String(e.action)} ${String(e.vnode ?? "")} ${String(
              e.note ?? ""
            )}`
        )
        .join("\n")
      const sched = trace
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")

      expect(reconcile).to.include("reconcileTemplateHoles section holeCount=5")
      expect(sched).to.include(
        "phase=hydrate-host-enter type=form testid=forms-demo-form"
      )
    })
  })
})
