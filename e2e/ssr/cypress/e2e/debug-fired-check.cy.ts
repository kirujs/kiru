describe("debug fired check", () => {
  it("checks submit and linked click fired traces", () => {
    const port = Cypress.env("port")

    cy.visit(`http://127.0.0.1:${port}/forms/demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="forms-demo-submit"]').click()
    cy.window().then((w) => {
      const trace = (((w as any).__kiruHydrationTrace ?? []) as Array<any>)
      const sched = trace
        .filter((e) => e?.ctx === "readiness:scheduler")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(sched).to.include(
        "phase=hydrate-host-enter type=form testid=forms-demo-form"
      )
      const txt = trace
        .filter((e) => e?.ctx === "readiness:binding")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.include(
        "phase=dom-event-fired event=submit tag=form testid=forms-demo-form"
      )
    })

    cy.visit(`http://127.0.0.1:${port}/default-export-demo`)
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    cy.get('[data-testid="linked-default-get"]').click()
    cy.window().then((w) => {
      const txt = (((w as any).__kiruHydrationTrace ?? []) as Array<any>)
        .filter((e) => e?.ctx === "readiness:binding")
        .map((e) => String(e.note ?? ""))
        .join("\n")
      expect(txt).to.include(
        "phase=dom-event-fired event=click tag=button testid=linked-default-get"
      )
    })
  })
})
