describe("debug refresh churn", () => {
  it("captures refresh phases around forms hydration", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const txt = (((w as any).__kiruHydrationTrace ?? []) as Array<any>)
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.include("phase=ssr-refresh-start")
      expect(txt).to.not.include("phase=ssr-refresh-commit-skip-null path=/forms/demo")
    })
  })
})
