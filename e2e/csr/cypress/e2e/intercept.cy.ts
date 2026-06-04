describe("route interceptors", () => {
  const port = () => Cypress.env("port")

  beforeEach(() => {
    cy.visit(`http://localhost:${port()}/photos`)
  })

  it("opens modal on soft nav while keeping feed mounted", () => {
    cy.get('[data-testid="photo-link-123"]').click()
    cy.location("pathname").should("eq", "/photos/123")
    cy.get('[data-testid="photos-feed"]').should("exist")
    cy.get('[data-testid="photo-modal"]').should("exist")
    cy.get('[data-testid="photo-modal"]').should(
      "have.attr",
      "data-photo-title",
      "Photo 123"
    )
    cy.get('[data-testid="photo-detail-page"]').should("not.exist")
  })

  it("restore closes modal and returns to feed URL", () => {
    cy.get('[data-testid="photo-link-123"]').click()
    cy.get('[data-testid="photo-modal-close"]').click()
    cy.location("pathname").should("eq", "/photos")
    cy.get('[data-testid="photo-modal"]').should("not.exist")
    cy.get('[data-testid="photos-feed"]').should("exist")
  })

  it("hard nav with intercept:false renders full page", () => {
    cy.get('[data-testid="photo-link-456-full"]').click()
    cy.location("pathname").should("eq", "/photos/456")
    cy.get('[data-testid="photo-detail-page"]').should("exist")
    cy.get('[data-testid="photo-modal"]').should("not.exist")
  })

  it("refresh at intercepted URL renders full page", () => {
    cy.visit(`http://localhost:${port()}/photos/123`)
    cy.get('[data-testid="photo-detail-page"]').should("exist")
    cy.get('[data-testid="photo-modal"]').should("not.exist")
  })
})
