describe("debug bootstrap outlet", () => {
  it("captures initial SSR outlet build for forms route", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.window().then((w) => {
      const trace = ((w as any).__kiruHydrationTrace ?? []) as Array<any>
      const txt = trace
        .filter((e) => typeof e?.ctx === "string" && e.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.include("phase=ssr-bootstrap-match")
      expect(txt).to.include("path=/forms/demo")
      expect(txt).to.include("phase=ssr-outlet-build-start")
      expect(txt).to.include("phase=ssr-outlet-build-done")
      expect(txt).to.include("hasSubtree=true")
    })
  })
})
