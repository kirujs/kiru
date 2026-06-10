/** Full-app navigation tour with diagnostics invariants at every step. */

function visitThreadboard(port: number, anonymous = false) {
  cy.visit(`http://127.0.0.1:${port}/threadboard`, {
    headers: anonymous ? { "x-e2e-anonymous": "1" } : undefined,
    onBeforeLoad(win) {
      win.localStorage.setItem("kiru-outlet-debug", "1")
      win.__kiruOutletDebug = true
    },
  })
  cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
  cy.get('[data-testid="community-kiru"]', { timeout: 10_000 }).should(
    "be.visible"
  )
}

describe("Threadboard navigation tour", () => {
  afterEach(function () {
    if (this.currentTest?.state === "failed") {
      cy.logRouterDiagnostics(`failed:${this.currentTest.title}`)
    }
  })

  it("walks the app with link + history navigation and diagnostics at each step", () => {
    const port = Cypress.env("port")
    visitThreadboard(port)

    // 1. Hydrate home
    cy.get('[data-testid="feed-post-p-1"]', { timeout: 10_000 }).should(
      "be.visible"
    )
    cy.assertNavDiagnostics({
      label: "1-hydrate-home",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      settled: false,
      dom: {
        home: true,
        layout: true,
        feedPost: true,
        appNotEmpty: true,
      },
      minInterceptorRegisters: 1,
    })

    // 2–9. Post intercept + open full page (before community leaf navigations)
    cy.get('[data-testid="feed-post-title-p-1"]').click()
    cy.get('[data-testid="post-modal"]', { timeout: 10_000 }).should(
      "be.visible"
    )
    cy.assertNavDiagnostics({
      label: "2-post-intercept",
      pathname: "/threadboard/p/p-1",
      matchRoutePath: "/threadboard",
      interceptActive: true,
      interceptTargetPathname: "/threadboard/p/p-1",
      interceptBackgroundPathname: "/threadboard",
      dom: {
        postModal: true,
        postPage: false,
        home: true,
        layout: true,
        appNotEmpty: true,
      },
    })

    cy.go("back")
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should("exist")
    cy.get('[data-testid="post-modal"]').should("not.exist")
    cy.assertNavDiagnostics({
      label: "3-back-dismiss-intercept",
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
      label: "3b-forward-restore-intercept",
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

    cy.go("back")
    cy.get('[data-testid="post-modal"]').should("not.exist")

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
    cy.get('[data-testid="post-open-full-page"]').click()
    cy.get('[data-testid="threadboard-post-page"]', { timeout: 10_000 }).should(
      "exist"
    )
    cy.assertNavDiagnostics({
      label: "4-open-full-page",
      pathname: "/threadboard/p/p-1",
      matchRoutePath: "/threadboard/p/[id]",
      interceptActive: false,
      dom: {
        postPage: true,
        postModal: false,
        home: false,
        layout: true,
        appNotEmpty: true,
      },
    })

    cy.go("back")
    cy.waitForNavSettled()
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-community-kiru"]').should("not.exist")
    cy.assertNavDiagnostics({
      label: "7-back-from-full-post",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      dom: {
        postPage: false,
        home: true,
        layout: true,
        appNotEmpty: true,
      },
    })

    cy.historyForward({
      label: "7b-forward-restore-full-post",
      pathname: "/threadboard/p/p-1",
      matchRoutePath: "/threadboard/p/[id]",
      interceptActive: false,
      dom: {
        postPage: true,
        postModal: false,
        home: false,
        layout: true,
        appNotEmpty: true,
      },
    })

    cy.go("back")
    cy.waitForNavSettled()
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-community-kiru"]').should("not.exist")

    // 10–13. Community + history
    cy.resetBlankFrameCount()
    cy.get('[data-testid="community-kiru"] a').click()
    cy.waitForNavSettled()
    cy.location("pathname").should("eq", "/threadboard/c/kiru")
    cy.get('[data-testid="threadboard-community-kiru"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="feed-post-p-3"]').should("not.exist")
    cy.assertNoBlankFrames()
    cy.assertNavDiagnostics({
      label: "8-community",
      pathname: "/threadboard/c/kiru",
      matchRoutePath: "/threadboard/c/[slug]",
      interceptActive: false,
      dom: {
        communityKiru: true,
        home: false,
        layout: true,
        appNotEmpty: true,
      },
      maxBlankFrames: 0,
    })

    cy.get('[data-testid="community-webdev"] a').click()
    cy.waitForNavSettled()
    cy.location("pathname").should("eq", "/threadboard/c/webdev")
    cy.get('[data-testid="threadboard-community-webdev"]').should("exist")
    cy.get('[data-testid="feed-post-p-3"]').should("be.visible")
    cy.get('[data-testid="feed-post-p-1"]').should("not.exist")
    cy.assertNoBlankFrames()

    cy.go("back")
    cy.waitForNavSettled()
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-community-kiru"]').should("not.exist")
    cy.assertNavDiagnostics({
      label: "9-back-home-from-community",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      dom: { home: true, communityKiru: false, layout: true, appNotEmpty: true },
    })

    cy.get('[data-testid="community-kiru"] a').click()
    cy.waitForNavSettled()
    cy.location("pathname").should("eq", "/threadboard/c/kiru")
    cy.get('[data-testid="threadboard-community-kiru"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-layout"] header')
      .contains("a", "Threadboard")
      .click()
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.assertNavDiagnostics({
      label: "10-header-home",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      dom: { home: true, communityKiru: false, layout: true, appNotEmpty: true },
    })

    // 14–15. Login intercept (anonymous)
    visitThreadboard(port, true)
    cy.contains("a", "Sign in").click()
    cy.get('[data-testid="login-modal"]', { timeout: 10_000 }).should(
      "be.visible"
    )
    cy.assertNavDiagnostics({
      label: "11-login-intercept",
      pathname: "/threadboard/login",
      matchRoutePath: "/threadboard",
      interceptActive: true,
      dom: {
        loginModal: true,
        loginPage: false,
        home: true,
        layout: true,
        appNotEmpty: true,
      },
    })
    cy.go("back")
    cy.get('[data-testid="login-modal"]').should("not.exist")
    cy.assertNavDiagnostics({
      label: "12-back-dismiss-login",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      dom: {
        loginModal: false,
        home: true,
        layout: true,
        appNotEmpty: true,
      },
    })

    // 16. Leaf routes + back chain
    visitThreadboard(port)
    cy.visit(`http://127.0.0.1:${port}/threadboard/about`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="threadboard-about"]').should("exist")
    cy.assertNavDiagnostics({
      label: "13-about",
      pathname: "/threadboard/about",
      matchRoutePath: "/threadboard/about",
      interceptActive: false,
      dom: { about: true, home: false, layout: true, appNotEmpty: true },
    })
    cy.go("back")
    cy.get('[data-testid="threadboard-home"]').should("exist")

    cy.visit(`http://127.0.0.1:${port}/threadboard/u/e2e_user`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="threadboard-user-page"]').should("exist")
    cy.visit(`http://127.0.0.1:${port}/threadboard/settings`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="threadboard-settings"]').should("exist")
    cy.visit(`http://127.0.0.1:${port}/threadboard/c/kiru/submit`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="threadboard-submit"]').should("exist")

    cy.go("back")
    cy.get('[data-testid="threadboard-settings"]').should("exist")
    cy.go("back")
    cy.get('[data-testid="threadboard-user-page"]').should("exist")

    // 17. Rapid navigation smoke (community ↔ home, no intercept after community)
    cy.visit(`http://127.0.0.1:${port}/threadboard`)
    cy.get("#app").should("have.attr", "data-kiru-hydrated-at")
    cy.get('[data-testid="community-kiru"] a').click()
    cy.waitForNavSettled()
    cy.location("pathname").should("eq", "/threadboard/c/kiru")
    cy.get('[data-testid="threadboard-community-kiru"]').should("exist")
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-layout"] header')
      .contains("a", "Threadboard")
      .click()
    cy.waitForNavSettled()
    cy.location("pathname").should("eq", "/threadboard")
    cy.get('[data-testid="threadboard-home"]', { timeout: 15_000 }).should(
      "exist"
    )
    cy.get('[data-testid="feed-post-p-1"]').should("be.visible")
    cy.get('[data-testid="threadboard-community-kiru"]').should("not.exist")
    cy.assertNavDiagnostics({
      label: "14-rapid-smoke",
      pathname: "/threadboard",
      matchRoutePath: "/threadboard",
      interceptActive: false,
      dom: {
        home: true,
        postModal: false,
        layout: true,
        appNotEmpty: true,
      },
    })
  })
})
