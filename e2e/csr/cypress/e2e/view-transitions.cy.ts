describe("View Transitions API", () => {
  const port = () => Cypress.expose("port")

  it("calls document.startViewTransition on navigate when transition is enabled", () => {
    cy.visit(`http://localhost:${port()}/view-transitions`)
    cy.window().then((win) => {
      const stub = cy
        .stub(win.document, "startViewTransition")
        .callsFake((updateCallback: () => void | Promise<void>) => {
          void Promise.resolve(updateCallback())
          return {
            finished: Promise.resolve(),
            skipTransition: () => {},
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
          }
        })
      cy.wrap(stub).as("startVT")
    })
    cy.get('[data-testid="vt-nav-about"]').click()
    cy.get('[data-testid="csr-about"]').should("exist")
    cy.get("@startVT").should("have.been.called")
  })
})
