describe("debug remaining throw pages", () => {
  const pages = [
    "/nested-streaming-test",
    "/rpc",
    "/default-export-demo",
    "/loaders-server",
  ]

  for (const page of pages) {
    it(`checks template-hydrate-throw on ${page}`, () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}${page}`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.window().then((w) => {
        const txt = (((w as any).__kiruHydrationTrace ?? []) as Array<any>)
          .filter((e) => e?.ctx === "readiness:scheduler")
          .map((e) => String(e.note ?? ""))
          .join("\n")
        expect(txt).to.not.include("phase=template-hydrate-throw")
      })
    })
  }
})
