/** Sandbox-parity DOM assertions for the e2e/ssr Threadboard replica. */

describe("Threadboard sandbox parity", () => {
  describe("Hydrate — initial /threadboard visit", () => {
    it("shows layout, feed, and streamed communities after hydrate", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('[data-testid="threadboard-layout"]').should("be.visible")
      cy.get('[data-testid="threadboard-home"]').should("be.visible")
      cy.get('[data-testid="feed-post-p-1"]').should(
        "contain",
        "How does query cache seeding work"
      )
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 })
        .should("be.visible")
        .and("contain", "c/kiru")
      cy.get('[data-testid="feed-fallback"]').should("not.exist")
      cy.get('[data-testid="communities-fallback"]').should("not.exist")
      cy.get("#app").children().should("have.length.at.least", 1)
    })
  })

  describe("Route interceptors — post modal", () => {
    afterEach(function () {
      if (this.currentTest?.state === "failed") {
        cy.logRouterDiagnostics(`failed:${this.currentTest.title}`)
      }
    })

    it("opens post modal without blanking the app", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="post-modal"]').should(
        "contain",
        "How does query cache seeding work"
      )
      cy.get('[data-testid="threadboard-layout"]').should("be.visible")
      cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
      cy.get("#app").invoke("text").should("have.length.gt", 50)
      cy.get('[data-testid="post-modal"]').contains("button", "Close").click()
      cy.get('[data-testid="post-modal"]').should("not.exist")
      cy.location("pathname").should("eq", "/threadboard")
    })

    it("opens post modal after returning from full post page", () => {
      const port = Cypress.env("port")
      cy.enableKiruDiagnostics()
      cy.visit(`http://127.0.0.1:${port}/threadboard/p/p-1`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('[data-testid="threadboard-post-page"]').should("exist")
      cy.get('[data-testid="threadboard-layout"] header')
        .contains("a", "Threadboard")
        .click()
      cy.waitForNavSettled()
      cy.location("pathname").should("eq", "/threadboard")
      cy.get('[data-testid="threadboard-post-page"]').should("not.exist")
      cy.get('[data-testid="feed-post-p-1"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.assertNavDiagnostics({
        label: "post-home-before-intercept",
        pathname: "/threadboard",
        matchRoutePath: "/threadboard",
        interceptActive: false,
        dom: {
          home: true,
          postPage: false,
          feedPost: true,
          layout: true,
          appNotEmpty: true,
        },
      })
      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.waitForNavSettled()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.assertNavDiagnostics({
        label: "post-home-intercept",
        pathname: "/threadboard/p/p-1",
        matchRoutePath: "/threadboard",
        interceptActive: true,
        dom: {
          postModal: true,
          postPage: false,
          home: true,
          feedPost: true,
          layout: true,
          appNotEmpty: true,
        },
      })
    })

    it("open full page from modal commits post leaf", () => {
      const port = Cypress.env("port")
      cy.enableKiruDiagnostics()
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="post-open-full-page"]').click()
      cy.waitForNavSettled()
      cy.get('[data-testid="threadboard-post-page"]', { timeout: 15_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="post-modal"]').should("not.exist")
      cy.location("pathname").should("eq", "/threadboard/p/p-1")
    })
  })

  describe("Route interceptors — login modal", () => {
    it("opens login modal and restores URL on close", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/threadboard`, {
        headers: { "x-e2e-anonymous": "1" },
      })
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.contains("a", "Sign in").click()
      cy.get('[data-testid="login-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="login-modal"]')
        .contains("button", /close/i)
        .click()
      cy.location("pathname").should("eq", "/threadboard")
    })
  })

  describe("History navigation", () => {
    it("forward restores intercept state after back from modal", () => {
      const port = Cypress.env("port")
      cy.enableKiruDiagnostics()
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.historyBack({
        label: "back-dismiss-intercept",
        pathname: "/threadboard",
        matchRoutePath: "/threadboard",
        interceptActive: false,
        dom: {
          postModal: false,
          home: true,
          feedPost: true,
          layout: true,
          appNotEmpty: true,
        },
      })
      cy.historyForward({
        label: "forward-restore-intercept",
        pathname: "/threadboard/p/p-1",
        matchRoutePath: "/threadboard",
        interceptActive: true,
        dom: {
          postModal: true,
          postPage: false,
          home: true,
          layout: true,
          appNotEmpty: true,
        },
      })
    })
  })

  describe("Abort / navigation regression", () => {
    it("survives rapid post modal open/close without wiping #app", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
        "be.visible"
      )

      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="post-modal"]').contains("button", "Close").click()
      cy.get('[data-testid="post-modal"]').should("not.exist")

      cy.get('[data-testid="feed-post-title-p-1"]').click()
      cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
        "be.visible"
      )
      cy.get('[data-testid="post-modal"]').contains("button", "Close").click()

      cy.get("#app").children().should("have.length.at.least", 1)
      cy.get('[data-testid="threadboard-layout"]').should("be.visible")
    })
  })

  describe("Voting", () => {
    it("optimistically updates post score on upvote", () => {
      const port = Cypress.env("port")
      cy.visit(`http://127.0.0.1:${port}/threadboard`, {
        headers: { "x-e2e-user-username": "demo" },
      })
      cy.get('[data-testid="vote-score-p-1"]').should("contain", "12")
      cy.get('[data-testid="vote-up-p-1"]').click()
      cy.get('[data-testid="vote-score-p-1"]', { timeout: 10_000 }).should(
        "contain",
        "13"
      )
    })
  })

  describe("Layout persistence", () => {
    it("keeps sidebar link DOM identity across leaf navigation", () => {
      const port = Cypress.env("port")
      cy.resetBlankFrameCount()
      cy.visit(`http://127.0.0.1:${port}/threadboard/about`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
      cy.get('[data-testid="threadboard-about"]').should("exist")
      cy.get('[data-testid="feed-post-p-1"]').should("not.exist")
      cy.get('[data-testid="community-kiru"] a').then(($linkBefore) => {
        const elBefore = $linkBefore[0]
        cy.get('[data-testid="community-kiru"] a').click()
        cy.waitForNavSettled()
        cy.location("pathname").should("eq", "/threadboard/c/kiru")
        cy.get('[data-testid="threadboard-community-kiru"]', {
          timeout: 15_000,
        }).should("exist")
        cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
        cy.get('[data-testid="threadboard-about"]').should("not.exist")
        cy.assertNoBlankFrames()
        cy.get('[data-testid="community-kiru"] a').then(($linkAfter) => {
          expect($linkAfter[0], "sidebar link should be same DOM node").to.eq(
            elBefore
          )
        })
      })
    })
  })

  describe("Sidebar community navigation", () => {
    it("loops kiru and webdev feeds with correct content", () => {
      const port = Cypress.env("port")
      cy.resetBlankFrameCount()
      cy.visit(`http://127.0.0.1:${port}/threadboard`)
      cy.get("#app").should("have.attr", "data-kiru-hydrated-at")

      for (let i = 0; i < 6; i++) {
        cy.get('[data-testid="community-kiru"] a').click()
        cy.waitForNavSettled()
        cy.get('[data-testid="threadboard-community-kiru"]', {
          timeout: 15_000,
        }).should("exist")
        cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
        cy.get('[data-testid="feed-post-p-3"]').should("not.exist")
        cy.assertNoBlankFrames()

        cy.get('[data-testid="community-webdev"] a').click()
        cy.waitForNavSettled()
        cy.get('[data-testid="threadboard-community-webdev"]').should("exist")
        cy.get('[data-testid="feed-post-p-3"]').should("be.visible")
        cy.get('[data-testid="feed-post-p-1"]').should("not.exist")
        cy.assertNoBlankFrames()
      }
    })
  })
})
