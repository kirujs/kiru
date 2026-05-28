describe("debug forms reconcile", () => {
  it("checks form vnode create/hydrate trace entries", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const txt = trace
        .filter((e) => typeof e?.action === "string")
        .map((e) => `${e.action} ${String(e.vnode ?? "")} ${String(e.note ?? "")}`)
        .join("\n")
      expect(txt).to.include("createChild form[data-testid=forms-demo-form]")
      expect(txt).to.include("hydrateVNode form[data-testid=forms-demo-form]")
    })
  })
})
