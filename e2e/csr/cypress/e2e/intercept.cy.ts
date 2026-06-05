describe("route interceptors", () => {
  const port = () => Cypress.env("port")

  describe("photos feed (layout scope)", () => {
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

  describe("home cross-route (layout scope)", () => {
    beforeEach(() => {
      cy.visit(`http://localhost:${port()}/`)
    })

    it("opens modal from home while keeping home mounted", () => {
      cy.get('[data-testid="home-photo-link-123"]').click()
      cy.location("pathname").should("eq", "/photos/123")
      cy.get('[data-testid="home-page"]').should("exist")
      cy.get('[data-testid="photo-modal"]').should("exist")
      cy.get('[data-testid="photo-detail-page"]').should("not.exist")
    })

    it("restore returns to home", () => {
      cy.get('[data-testid="home-photo-link-123"]').click()
      cy.get('[data-testid="photo-modal-close"]').click()
      cy.location("pathname").should("eq", "/")
      cy.get('[data-testid="photo-modal"]').should("not.exist")
      cy.get('[data-testid="home-page"]').should("exist")
    })

    it("browser back returns to home", () => {
      cy.get('[data-testid="home-photo-link-123"]').click()
      cy.go("back")
      cy.location("pathname").should("eq", "/")
      cy.get('[data-testid="photo-modal"]').should("not.exist")
      cy.get('[data-testid="home-page"]').should("exist")
    })
  })

  describe("about user preview (page route)", () => {
    it("opens preview from about while keeping about mounted", () => {
      cy.visit(`http://localhost:${port()}/about`)
      cy.get('[data-testid="about-user-link-99"]').click()
      cy.location("pathname").should("eq", "/users/99")
      cy.get('[data-testid="csr-about"]').should("exist")
      cy.get('[data-testid="user-preview-modal"]').should("exist")
      cy.get('[data-testid="csr-user"]').should("not.exist")
    })

    it("restore returns to about", () => {
      cy.visit(`http://localhost:${port()}/about`)
      cy.get('[data-testid="about-user-link-99"]').click()
      cy.get('[data-testid="user-preview-close"]').click()
      cy.location("pathname").should("eq", "/about")
      cy.get('[data-testid="user-preview-modal"]').should("not.exist")
      cy.get('[data-testid="csr-about"]').should("exist")
    })

    it("home link uses full page without page-owned interceptor", () => {
      cy.visit(`http://localhost:${port()}/`)
      cy.get('[data-testid="home-user-link-99"]').click()
      cy.location("pathname").should("eq", "/users/99")
      cy.get('[data-testid="csr-user"]').should("exist")
      cy.get('[data-testid="user-preview-modal"]').should("not.exist")
      cy.get('[data-testid="csr-about"]').should("not.exist")
    })
  })
})
