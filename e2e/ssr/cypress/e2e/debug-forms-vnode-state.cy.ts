describe("debug forms vnode state", () => {
  it("inspects template hole metadata on forms section", () => {
    const port = Cypress.env("port")
    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="forms-demo"]').then(($el) => {
      const vnode = ($el.get(0) as any).__kiruNode as any
      expect(vnode).to.exist
      expect(vnode.templateHoleCount).to.eq(5)
      expect(Array.isArray(vnode.templateHoleChildren)).to.eq(true)
      expect((vnode.templateHoleChildren ?? []).length).to.eq(5)
      expect(vnode.child != null).to.eq(true)
    })
  })
})
