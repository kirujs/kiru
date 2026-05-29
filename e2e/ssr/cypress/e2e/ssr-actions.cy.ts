describe("SSR server", () => {
  beforeEach(() => {
    const port = Cypress.expose("port")
    cy.visit(`http://127.0.0.1:${port}/`)
  })

  it("executes remote functions through server action endpoint", () => {
    // Without the SSR-injected token, the action handler rejects the POST and the UI never updates.
    cy.get("script[k-request-token]").should("exist")
    // Streaming SSR + async entry: `load` fires before hydrate attaches event handlers.
    cy.window().its("__kiruHydratedAt").should("be.a", "number")
    // Wait for the server round-trip explicitly — avoids races under load / parallel CI.
    cy.intercept("POST", /\?action=/).as("remoteAction")
    cy.get('[data-testid="ssr-remote-button"]').click()
    cy.wait("@remoteAction").its("response.statusCode").should("eq", 200)
    cy.get('[data-testid="ssr-remote-result"]').should(
      "have.text",
      "hello from server (E2E User)"
    )
  })

  describe("action middleware", () => {
    const visitMiddlewareDemo = () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/action-middleware-demo`)
      cy.get("script[k-request-token]").should("exist")
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
    }

    it("returns 403 when middleware header gate is missing", () => {
      visitMiddlewareDemo()
      cy.intercept("POST", /\?action=/).as("middlewareDenied")
      cy.get('[data-testid="mw-gated-denied"]').click()
      cy.wait("@middlewareDenied").its("response.statusCode").should("eq", 403)
      cy.get('[data-testid="mw-gated-denied-result"]').should(
        "contain",
        "Action failed"
      )
    })

    it("passes custom request headers through client dispatch", () => {
      visitMiddlewareDemo()
      cy.intercept("POST", /\?action=/).as("middlewareAllowed")
      cy.get('[data-testid="mw-gated-allowed"]').click()
      cy.wait("@middlewareAllowed").then(({ request, response }) => {
        expect(request.headers["x-e2e-action-secret"]).to.eq("open-sesame")
        expect(response?.statusCode).to.eq(200)
      })
      cy.get('[data-testid="mw-gated-result"]').should(
        "have.text",
        '{"echo":"open-sesame"}'
      )
    })

    it("allows context-based middleware guard with SSR token context", () => {
      visitMiddlewareDemo()
      cy.intercept("POST", /\?action=/).as("middlewareAuth")
      cy.get('[data-testid="mw-auth"]').click()
      cy.wait("@middlewareAuth").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="mw-auth-result"]').should(
        "have.text",
        '{"user":"E2E User"}'
      )
    })
  })

  describe("form actions", () => {
    it("submits via progressive enhancement and shows JSON result", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/forms/demo`)
      cy.get("script[k-request-token]").should("exist")
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.intercept("POST", /\?action=/).as("formAction")
      cy.get('[data-testid="forms-demo-input"]').type("from-cypress")
      cy.get('[data-testid="forms-demo-submit"]').click()
      cy.wait("@formAction").then((interception) => {
        expect(interception.response?.statusCode).to.eq(200)
        expect(interception.request.headers["x-kiru-form"]).to.eq("1")
      })
      cy.get('[data-testid="forms-demo-result"]').should(
        "have.text",
        "from-cypress"
      )
    })

    it("redirects after enhanced form submit", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/forms/demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.get('[data-testid="forms-demo-redirect"]').click()
      cy.location("pathname").should("eq", "/hello")
      cy.get('[data-testid="ssr-loader"]').should("exist")
    })

    it("surfaces validation errors from action return value", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/forms/demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.intercept("POST", /\?action=/).as("formValidation")
      cy.get('[data-testid="forms-validation-submit"]').click()
      cy.wait("@formValidation").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="forms-validation-error"]').should(
        "have.text",
        "Required"
      )
    })

    it("clears validation error after successful enhanced submit", () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/forms/demo`)
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
      cy.intercept("POST", /\?action=/).as("formValidation")
      cy.get('[data-testid="forms-validation-submit"]').click()
      cy.wait("@formValidation").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="forms-validation-error"]').should(
        "have.text",
        "Required"
      )
      cy.get('[data-testid="forms-validation-input"]').type("ok")
      cy.get('[data-testid="forms-validation-submit"]').click()
      cy.wait("@formValidation").then((interception) => {
        expect(interception.response?.statusCode).to.eq(200)
        expect(interception.request.headers["x-kiru-form"]).to.eq("1")
      })
      cy.get('[data-testid="forms-validation-error"]').should("have.text", "")
    })
  })

  describe("namespaced and composed remote actions", () => {
    const visitActionsDemo = () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/actions-composition-demo`)
      cy.get("script[k-request-token]").should("exist")
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
    }

    it("invokes a namespaced RPC action with a dotted RPC id", () => {
      visitActionsDemo()
      cy.intercept("POST", /\?action=[^&]*api\.getEcho/).as("namespaceGet")
      cy.get('[data-testid="namespace-get"]').click()
      cy.wait("@namespaceGet").then(({ request, response }) => {
        expect(request.method).to.eq("POST")
        expect(response?.statusCode).to.eq(200)
        const actionId = new URL(request.url).searchParams.get("action")
        expect(actionId).to.include("api.getEcho")
      })
      cy.get('[data-testid="namespace-get-result"]').should(
        "have.text",
        "echo:E2E User"
      )
    })

    it("composed POST runs nested namespaced actions in one HTTP round-trip", () => {
      visitActionsDemo()
      cy.intercept("POST", /\?action=[^&]*runPipeline/).as("composeAction")
      cy.get('[data-testid="compose-run"]').click()
      cy.wait("@composeAction").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="compose-result"]').should(
        "have.text",
        JSON.stringify({
          echo: "echo:E2E User",
          ping: { pong: true },
          nested: true,
        })
      )
    })

    it("invokes a namespaced RPC action with a JSON body", () => {
      visitActionsDemo()
      cy.intercept("POST", /\?action=[^&]*api\.removeLabel/).as(
        "namespaceDelete"
      )
      cy.get('[data-testid="namespace-delete"]').click()
      cy.wait("@namespaceDelete").then(({ request, response }) => {
        expect(request.method).to.eq("POST")
        expect(response?.statusCode).to.eq(200)
      })
      cy.get('[data-testid="namespace-delete-result"]').should(
        "have.text",
        JSON.stringify({ removed: "demo", had: true })
      )
    })
  })

  describe("default export remote actions", () => {
    const visitDefaultExportDemo = () => {
      const port = Cypress.expose("port")
      cy.visit(`http://127.0.0.1:${port}/default-export-demo`)
      cy.get("script[k-request-token]").should("exist")
      cy.window().its("__kiruHydratedAt").should("be.a", "number")
    }

    it("invokes literal default export RPC with default.getEcho RPC id", () => {
      visitDefaultExportDemo()
      cy.intercept("POST", /\?action=[^&]*default\.getEcho/).as(
        "literalDefaultGet"
      )
      cy.get('[data-testid="literal-default-get"]').click()
      cy.wait("@literalDefaultGet").then(({ request, response }) => {
        expect(request.method).to.eq("POST")
        expect(response?.statusCode).to.eq(200)
        const actionId = new URL(request.url).searchParams.get("action")
        expect(actionId).to.include("default.getEcho")
      })
      cy.get('[data-testid="literal-default-result"]').should(
        "have.text",
        "literal-default:E2E User"
      )
    })

    it("invokes linked default export RPC with default.getEcho RPC id", () => {
      visitDefaultExportDemo()
      cy.intercept("POST", /\?action=[^&]*default\.getEcho/).as(
        "linkedDefaultGet"
      )
      cy.get('[data-testid="linked-default-get"]').click()
      cy.wait("@linkedDefaultGet").then(({ request, response }) => {
        expect(request.method).to.eq("POST")
        expect(response?.statusCode).to.eq(200)
        const actionId = new URL(request.url).searchParams.get("action")
        expect(actionId).to.include("default.getEcho")
      })
      cy.get('[data-testid="linked-default-result"]').should(
        "have.text",
        "linked-default:E2E User"
      )
    })

    it("composed POST runs in-process catalog.getEcho via linked binding", () => {
      visitDefaultExportDemo()
      cy.intercept("POST", /\?action=[^&]*runPipeline/).as("linkedCompose")
      cy.get('[data-testid="linked-compose-run"]').click()
      cy.wait("@linkedCompose").its("response.statusCode").should("eq", 200)
      cy.get('[data-testid="linked-compose-result"]').should(
        "have.text",
        JSON.stringify({
          echo: "linked-default:E2E User",
          linked: true,
        })
      )
    })
  })
})
