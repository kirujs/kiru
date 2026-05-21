import { describe, it } from "node:test"
import assert from "node:assert"
import {
  action,
  formDataToInput,
  KIRU_FORM_TOKEN_FIELD,
  __INTERNAL_REMOTE_REGISTRY,
  buildRemoteActionContext,
  createRemoteActionHandler,
  redirect,
  type RemoteActionContext,
  type Schema,
} from "../../remote/index.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import { makeKiruContextToken } from "../../remote/token.js"

const SECRET = "test-secret-form-actions"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a form POST request with the specified action ID, token, and form data.
 * @param actionId - The action ID in the format "routeId:actionName"
 * @param token - The Kiru context token
 * @param formData - Object containing form field key-value pairs
 * @param options - Optional configuration for enhanced submission, referer, origin, and content-type
 */
function makeFormRequest(
  actionId: string,
  token: string,
  formData: Record<string, string>,
  options?: {
    enhanced?: boolean
    referer?: string
    origin?: string
    contentType?: string
  }
): Request {
  const headers: Record<string, string> = {}

  let body: BodyInit

  if (options?.contentType === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams()
    params.set(KIRU_FORM_TOKEN_FIELD, token)
    for (const [key, value] of Object.entries(formData)) {
      params.set(key, value)
    }
    body = params
    headers["content-type"] = "application/x-www-form-urlencoded"
  } else {
    const fd = new FormData()
    fd.set(KIRU_FORM_TOKEN_FIELD, token)
    for (const [key, value] of Object.entries(formData)) {
      fd.set(key, value)
    }
    body = fd
    // multipart/form-data must include a boundary; only set Content-Type for
    // urlencoded above. For FormData, omit it so the runtime adds boundary=...
    if (
      options?.contentType &&
      options.contentType !== "multipart/form-data"
    ) {
      headers["content-type"] = options.contentType
    }
  }

  if (options?.enhanced) {
    headers["x-kiru-form"] = "1"
    headers["accept"] = "application/json"
  }
  if (options?.referer) {
    headers["referer"] = options.referer
  }
  if (options?.origin) {
    headers["origin"] = options.origin
  }

  return new Request(`http://localhost/?action=${actionId}`, {
    method: "POST",
    headers,
    body,
  })
}

/**
 * Create a valid Kiru context token with the specified context object.
 * @param ctx - The context object to encode in the token
 */
function validToken(ctx: Record<string, unknown> = {}) {
  return makeKiruContextToken(ctx, SECRET)
}

function makeFormRequestFromFormData(
  actionId: string,
  token: string,
  build: (fd: FormData) => void,
  options?: { enhanced?: boolean }
): Request {
  const fd = new FormData()
  fd.set(KIRU_FORM_TOKEN_FIELD, token)
  build(fd)
  const headers: Record<string, string> = {}
  if (options?.enhanced) {
    headers["x-kiru-form"] = "1"
    headers["accept"] = "application/json"
  }
  return new Request(`http://localhost/?action=${actionId}`, {
    method: "POST",
    headers,
    body: fd,
  })
}

const messageSchema: Schema<{ message: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("message" in input)) {
      throw new Error("Invalid")
    }
    const message = (input as { message: unknown }).message
    if (typeof message !== "string" || !message.trim()) {
      throw new Error("Invalid")
    }
    return { message: message.trim() }
  },
}

type ContactInput = { email: string; avatar?: File }

const contactSchema: Schema<ContactInput> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("email" in input)) {
      throw new Error("Invalid")
    }
    const email = (input as { email: unknown }).email
    if (typeof email !== "string" || !email.includes("@")) {
      throw new Error("Invalid")
    }
    const avatar = (input as { avatar?: unknown }).avatar
    if (avatar !== undefined && !(avatar instanceof File)) {
      throw new Error("Invalid")
    }
    return {
      email,
      avatar: avatar instanceof File ? avatar : undefined,
    }
  },
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe("action.post (form) / wrapper", () => {
  it("should return object with __kiruFormAction set to true", () => {
    const formRef = action.post({ type: "form" }, async (_, _formData) => {
      return { success: true }
    })

    assert.strictEqual(formRef.__kiruFormAction, true)
  })

  it("should return object with __kiruFormActionId property", () => {
    const formRef = action.post({ type: "form" }, async () => {
      return { success: true }
    })

    assert.ok("__kiruFormActionId" in formRef)
    assert.strictEqual(typeof formRef.__kiruFormActionId, "string")
  })

  it("should return object with __kiruInvoke method", () => {
    const formRef = action.post({ type: "form" }, async () => {
      return { success: true }
    })

    assert.ok("__kiruInvoke" in formRef)
    assert.strictEqual(typeof formRef.__kiruInvoke, "function")
  })

  it("should pass context and FormData to callback via __kiruInvoke", async () => {
    let receivedCtx: unknown = null
    let receivedFormData: unknown = null

    const formRef = action.post({ type: "form" }, async (ctx, formData) => {
      receivedCtx = ctx
      receivedFormData = formData
      return { success: true }
    })

    const testCtx = { userId: "123", role: "admin" }
    const actionCtx = buildRemoteActionContext(testCtx, staticLoaderSignal())
    const testFormData = new FormData()
    testFormData.set("field1", "value1")
    testFormData.set("field2", "value2")

    await formRef.__kiruInvoke(actionCtx, testFormData)

    assert.deepStrictEqual(receivedCtx, actionCtx)
    assert.strictEqual(receivedFormData, testFormData)
  })

  it("should return Promise resolving to callback result", async () => {
    const expectedResult = { success: true, data: "test-data" }

    const formRef = action.post({ type: "form" }, async () => {
      return expectedResult
    })

    const result = formRef.__kiruInvoke(
      buildRemoteActionContext({}, staticLoaderSignal()),
      new FormData()
    )

    assert.ok(result instanceof Promise)
    assert.deepStrictEqual(await result, expectedResult)
  })

  it("should handle async callbacks correctly", async () => {
    const formRef = action.post({ type: "form" }, async (_, formData) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10))
      const name = formData.get("name")
      return { message: `Hello, ${name}` }
    })

    const formData = new FormData()
    formData.set("name", "Alice")

    const result = await formRef.__kiruInvoke(
      buildRemoteActionContext({}, staticLoaderSignal()),
      formData
    )

    assert.deepStrictEqual(result, { message: "Hello, Alice" })
  })

  it("should handle synchronous callbacks by wrapping in Promise", async () => {
    const formRef = action.post({ type: "form" }, (_, formData) => {
      const name = formData.get("name")
      return { message: `Hello, ${name}` }
    })

    const formData = new FormData()
    formData.set("name", "Bob")

    const result = formRef.__kiruInvoke(
      buildRemoteActionContext({}, staticLoaderSignal()),
      formData
    )

    assert.ok(result instanceof Promise)
    assert.deepStrictEqual(await result, { message: "Hello, Bob" })
  })
})

describe("formDataToInput", () => {
  it("omits the Kiru context token field", () => {
    const fd = new FormData()
    fd.set(KIRU_FORM_TOKEN_FIELD, "secret")
    fd.set("message", "hi")
    assert.deepStrictEqual(formDataToInput(fd), { message: "hi" })
  })

  it("collects repeated keys into arrays", () => {
    const fd = new FormData()
    fd.append("tag", "a")
    fd.append("tag", "b")
    assert.deepStrictEqual(formDataToInput(fd), { tag: ["a", "b"] })
  })

  it("preserves File values", () => {
    const file = new File(["png"], "avatar.png", { type: "image/png" })
    const fd = new FormData()
    fd.set("avatar", file)
    const raw = formDataToInput(fd)
    assert.ok(raw.avatar instanceof File)
    assert.strictEqual((raw.avatar as File).name, "avatar.png")
  })
})

describe("action.post (form + schema)", () => {
  it("parses FormData and passes typed input to the handler via __kiruInvoke", async () => {
    let received: { message: string } | null = null
    const formRef = action.post(
      { type: "form", schema: messageSchema },
      async (_ctx, input: { message: string }) => {
        received = input
        return { ok: true }
      }
    )

    const fd = new FormData()
    fd.set("message", "  hello  ")
    await formRef.__kiruInvoke(
      buildRemoteActionContext({}, staticLoaderSignal()),
      fd
    )

    assert.deepStrictEqual(received, { message: "hello" })
  })

  it("passes optional File fields after schema validation", async () => {
    const formRef = action.post(
      { type: "form", schema: contactSchema },
      async (_ctx, input) => ({
        email: input.email,
        hasAvatar: input.avatar instanceof File,
        avatarName: input.avatar?.name,
      })
    )

    const file = new File(["bytes"], "pic.png", { type: "image/png" })
    const fd = new FormData()
    fd.set("email", "a@b.co")
    fd.set("avatar", file)

    const result = await formRef.__kiruInvoke(
      buildRemoteActionContext({}, staticLoaderSignal()),
      fd
    )

    assert.deepStrictEqual(result, {
      email: "a@b.co",
      hasAvatar: true,
      avatarName: "pic.png",
    })
  })

  it("rejects invalid form input with INVALID_INPUT through the HTTP handler", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const routeId = "test/form-schema-invalid"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action.post(
        { type: "form", schema: messageSchema },
        async (_ctx, input) => ({ message: input.message })
      ),
    })

    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, { message: "" })
    const res = await handler(req)

    assert.strictEqual(res?.status, 400)
    const body = (await res?.json()) as { error: { code: string } }
    assert.strictEqual(body.error.code, "INVALID_INPUT")
  })

  it("accepts valid form fields through the HTTP handler (enhanced JSON)", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/form-schema-valid"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action.post(
        { type: "form", schema: messageSchema },
        async (_ctx, input) => ({ message: input.message })
      ),
    })

    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, {
      message: "from-form",
    }, { enhanced: true })
    const res = await handler(req)

    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { message: "from-form" })
  })

  it("accepts multipart File upload through the HTTP handler", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const routeId = "test/form-schema-file"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action.post(
        { type: "form", schema: contactSchema },
        async (_ctx, input) => ({
          email: input.email,
          hasAvatar: input.avatar instanceof File,
          avatarName: input.avatar?.name,
        })
      ),
    })

    const token = validToken()
    const req = makeFormRequestFromFormData(
      `${routeId}:submit`,
      token,
      (fd) => {
        fd.set("email", "user@example.com")
        fd.set("avatar", new File(["x"], "upload.bin", { type: "application/octet-stream" }))
      },
      { enhanced: true }
    )
    const res = await handler(req)

    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), {
      email: "user@example.com",
      hasAvatar: true,
      avatarName: "upload.bin",
    })
  })
})

describe("action.post (form) / registration", () => {
  it("should locate registered form action by route ID and action name", async () => {
    // Arrange: Create a form action and register it
    const routeId = "test/registration/locate"
    const actionName = "testAction"
    let callbackInvoked = false

    const formRef = action.post({ type: "form" }, async () => {
      callbackInvoked = true
      return { success: true }
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      [actionName]: formRef,
    })

    // Act: Create handler and invoke with matching route ID and action name
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken({ userId: 123 })
    const req = makeFormRequest(`${routeId}:${actionName}`, token, {
      field: "value",
    })
    const res = await handler(req)

    // Assert: Handler should successfully invoke the registered action
    assert.strictEqual(res?.status, 303) // Native submission redirects to referer
    assert.strictEqual(callbackInvoked, true)
  })

  it("should not interfere when multiple form actions are registered under same route ID", async () => {
    // Arrange: Register multiple actions under the same route ID
    const routeId = "test/registration/multiple"
    let action1Invoked = false
    let action2Invoked = false

    const action1 = action.post({ type: "form" }, async () => {
      action1Invoked = true
      return { action: "action1" }
    })

    const action2 = action.post({ type: "form" }, async () => {
      action2Invoked = true
      return { action: "action2" }
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      action1: action1,
      action2: action2,
    })

    // Act: Invoke action1
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req1 = makeFormRequest(`${routeId}:action1`, token, {
      field: "value",
    })
    const res1 = await handler(req1)

    // Assert: Only action1 should be invoked
    assert.strictEqual(res1?.status, 303)
    assert.strictEqual(action1Invoked, true)
    assert.strictEqual(action2Invoked, false)

    // Reset flags
    action1Invoked = false
    action2Invoked = false

    // Act: Invoke action2
    const req2 = makeFormRequest(`${routeId}:action2`, token, {
      field: "value",
    })
    const res2 = await handler(req2)

    // Assert: Only action2 should be invoked
    assert.strictEqual(res2?.status, 303)
    assert.strictEqual(action1Invoked, false)
    assert.strictEqual(action2Invoked, true)
  })

  it("should use most recent registration when registration is overwritten", async () => {
    // Arrange: Register an action, then overwrite it
    const routeId = "test/registration/overwrite"
    const actionName = "testAction"
    let firstCallbackInvoked = false
    let secondCallbackInvoked = false

    const firstAction = action.post({ type: "form" }, async () => {
      firstCallbackInvoked = true
      return { version: "first" }
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      [actionName]: firstAction,
    })

    const secondAction = action.post({ type: "form" }, async () => {
      secondCallbackInvoked = true
      return { version: "second" }
    })

    // Overwrite the registration
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      [actionName]: secondAction,
    })

    // Act: Invoke the action
    const handler = createRemoteActionHandler(SECRET)
    const token = validToken()
    const req = makeFormRequest(`${routeId}:${actionName}`, token, {
      field: "value",
    })
    const res = await handler(req)

    // Assert: Only the second (most recent) action should be invoked
    assert.strictEqual(res?.status, 303)
    assert.strictEqual(firstCallbackInvoked, false)
    assert.strictEqual(secondCallbackInvoked, true)
  })
})

describe("action.post (form) / native submission", () => {
  it("should process application/x-www-form-urlencoded content-type", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/urlencoded"

    let invoked = false
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        invoked = true
        return { success: true }
      }),
    })

    const token = validToken({ userId: "123" })
    const req = makeFormRequest(
      `${routeId}:testAction`,
      token,
      { field1: "value1" },
      { contentType: "application/x-www-form-urlencoded", referer: "/" }
    )

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(invoked, true)
    assert.strictEqual(res.status, 303) // Native non-redirect returns 303
  })

  it("should process multipart/form-data content-type", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/multipart"

    let invoked = false
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        invoked = true
        return { success: true }
      }),
    })

    const token = validToken({ userId: "123" })
    const req = makeFormRequest(
      `${routeId}:testAction`,
      token,
      { field1: "value1" },
      { contentType: "multipart/form-data", referer: "/" }
    )

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(invoked, true)
    assert.strictEqual(res.status, 303) // Native non-redirect returns 303
  })

  it("should return status 400 when __kiru_token is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/missing-token"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        return { success: true }
      }),
    })

    // Create request without token
    const fd = new FormData()
    fd.set("field1", "value1")

    const req = new Request(`http://localhost/?action=${routeId}:testAction`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: fd,
    })

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 400)
  })

  it("should return status 400 when __kiru_token is invalid", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/invalid-token"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        return { success: true }
      }),
    })

    const invalidToken = "invalid.token.signature"
    const req = makeFormRequest(`${routeId}:testAction`, invalidToken, {
      field1: "value1",
    })

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 400)
  })

  it("should unwrap context correctly with valid __kiru_token", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/valid-token"

    let receivedContext: unknown = null
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async (ctx, _formData) => {
        receivedContext = ctx
        return { success: true }
      }),
    })

    const expectedContext = {
      userId: "456",
      role: "admin",
      email: "test@example.com",
    }
    const token = validToken(expectedContext)
    const req = makeFormRequest(
      `${routeId}:testAction`,
      token,
      { field1: "value1" },
      { referer: "/" }
    )

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 303)
    assert.deepStrictEqual(
      receivedContext,
      buildRemoteActionContext(expectedContext, req.signal)
    )
  })

  it("should return null when action query parameter is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/no-action"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        return { success: true }
      }),
    })

    const token = validToken({ userId: "123" })
    const fd = new FormData()
    fd.set(KIRU_FORM_TOKEN_FIELD, token)
    fd.set("field1", "value1")

    // Create request without action query parameter
    const req = new Request(`http://localhost/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: fd,
    })

    const res = await handler(req)

    assert.strictEqual(res, null)
  })

  it("should return status 500 when action ID has no colon separator", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/malformed"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action.post({ type: "form" }, async () => {
        return { success: true }
      }),
    })

    const token = validToken({ userId: "123" })
    const fd = new FormData()
    fd.set(KIRU_FORM_TOKEN_FIELD, token)
    fd.set("field1", "value1")

    // Create request with malformed action ID (no colon)
    const req = new Request(`http://localhost/?action=malformedActionId`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: fd,
    })

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 500)
  })

  it("should return status 500 when action is not registered", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/unregistered"

    // Register a different action
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      otherAction: action.post({ type: "form" }, async () => {
        return { success: true }
      }),
    })

    const token = validToken({ userId: "123" })
    const req = makeFormRequest(`${routeId}:nonExistentAction`, token, {
      field1: "value1",
    })

    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 500)
  })
})

describe("action.post (form) / enhanced submission", () => {
  // Tests for fetch-based progressive enhancement
})

describe("action.post (form) / redirect handling", () => {
  it("returns JSON redirect for enhanced POST", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/redirect-enhanced"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action.post({ type: "form" }, async () => redirect(303, "/hello")),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 200)
    const body = JSON.parse(await res.text())
    assert.strictEqual(body.location, "/hello")
    assert.strictEqual(body.status, 303)
  })

  it("returns 303 Location for native POST redirect", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/redirect-native"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action.post({ type: "form" }, async () => redirect(303, "/hello")),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      contentType: "application/x-www-form-urlencoded",
    })
    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 303)
    assert.strictEqual(res.headers.get("location"), "/hello")
  })
})

describe("action.post (form) / error handling", () => {
  // Tests for error scenarios
})

describe("action.post (form) / origin validation", () => {
  // Tests for CSRF protection
})

describe("action.post (form) / context injection", () => {
  // Tests for request context handling
})

describe("createFormController / initialization", () => {
  // Tests for controller creation
})

describe("createFormController / submission", () => {
  // Tests for controller submission behavior
})

describe("createFormController / token management", () => {
  // Tests for automatic token handling
})
