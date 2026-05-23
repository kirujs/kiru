import { describe, it } from "node:test"
import assert from "node:assert"
import {
  action,
  formDataToInput,
  KIRU_FORM_TOKEN_FIELD,
  __INTERNAL_REMOTE_REGISTRY,
  createActionExecutionForRequest,
  createRemoteActionHandler,
  runInActionExecution,
  redirect,
  KIRU_TOKEN_RESPONSE_HEADER,
  type RemoteFormActionInvokeArgs,
  type Schema,
} from "../../remote/index.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import { makeKiruContextToken, unwrapKiruToken } from "../../remote/token.js"
import { RemoteError } from "../../remote/errors.js"
import type { CustomRequestContext } from "../../router/types.js"

const SECRET = "test-secret-form-actions"

async function invokeFormDirect<Output>(
  formRef: {
    __kiruInvoke: (
      args: RemoteFormActionInvokeArgs
    ) => Promise<{ handlerResult: Output }>
  },
  formData: FormData,
  context: CustomRequestContext = {}
): Promise<Output> {
  const execution = createActionExecutionForRequest({
    context,
    signal: staticLoaderSignal(),
    request: new Request("http://localhost/"),
    headers: new Headers(),
    body: formData,
    entryActionId: "test:form",
  })
  const { handlerResult } = await runInActionExecution(execution, () =>
    formRef.__kiruInvoke({
      formData,
      signal: execution.request.signal,
    })
  )
  return handlerResult
}

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
    const formRef = action({ type: "form", handler: async () => {
      return { success: true }
    },
    })

    assert.strictEqual(formRef.__kiruFormAction, true)
  })

  it("should return object with __kiruFormActionId property", () => {
    const formRef = action({ type: "form", handler: async () => {
      return { success: true }
    },
    })

    assert.ok("__kiruFormActionId" in formRef)
    assert.strictEqual(typeof formRef.__kiruFormActionId, "string")
  })

  it("should return object with __kiruInvoke method", () => {
    const formRef = action({ type: "form", handler: async () => {
      return { success: true }
    },
    })

    assert.ok("__kiruInvoke" in formRef)
    assert.strictEqual(typeof formRef.__kiruInvoke, "function")
  })

  it("should pass context and FormData to callback via __kiruInvoke", async () => {
    let receivedCtx: unknown = null
    let receivedFormData: unknown = null

    const formRef = action({ type: "form", handler: async ({ context, request, signal }) => {
      receivedCtx = { context, signal }
      receivedFormData = request.formData
      return { success: true }
    },
    })

    const testCtx = { userId: "123", role: "admin" }
    const testFormData = new FormData()
    testFormData.set("field1", "value1")
    testFormData.set("field2", "value2")

    await invokeFormDirect(formRef, testFormData, testCtx)

    assert.deepStrictEqual(receivedCtx, {
      context: testCtx,
      signal: staticLoaderSignal(),
    })
    assert.strictEqual(receivedFormData, testFormData)
  })

  it("should return Promise resolving to callback result", async () => {
    const expectedResult = { success: true, data: "test-data" }

    const formRef = action({ type: "form", handler: async () => {
      return expectedResult
    },
    })

    const result = await invokeFormDirect(formRef, new FormData())

    assert.deepStrictEqual(result, expectedResult)
  })

  it("should handle async callbacks correctly", async () => {
    const formRef = action({ type: "form", handler: async ({ request }) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10))
      const name = request.formData.get("name")
      return { message: `Hello, ${name}` }
    },
    })

    const formData = new FormData()
    formData.set("name", "Alice")

    const result = await invokeFormDirect(formRef, formData)

    assert.deepStrictEqual(result, { message: "Hello, Alice" })
  })

  it("should handle synchronous callbacks by wrapping in Promise", async () => {
    const formRef = action({ type: "form", handler: ({ request }) => {
      const name = request.formData.get("name")
      return { message: `Hello, ${name}` }
    },
    })

    const formData = new FormData()
    formData.set("name", "Bob")

    const result = await invokeFormDirect(formRef, formData)

    assert.deepStrictEqual(result, { message: "Hello, Bob" })
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
    const formRef = action({
      type: "form",
      validation: { body: messageSchema },
      handler: async ({ request }) => {
        received = request.body
        return { ok: true }
      },
    })

    const fd = new FormData()
    fd.set("message", "  hello  ")
    await invokeFormDirect(formRef, fd)

    assert.deepStrictEqual(received, { message: "hello" })
  })

  it("passes optional File fields after schema validation", async () => {
    const formRef = action({
      type: "form",
      validation: { body: contactSchema },
      handler: async ({ request }) => ({
        email: request.body.email,
        hasAvatar: request.body.avatar instanceof File,
        avatarName: request.body.avatar?.name,
      }),
    })

    const file = new File(["bytes"], "pic.png", { type: "image/png" })
    const fd = new FormData()
    fd.set("email", "a@b.co")
    fd.set("avatar", file)

    const result = await invokeFormDirect(formRef, fd)

    assert.deepStrictEqual(result, {
      email: "a@b.co",
      hasAvatar: true,
      avatarName: "pic.png",
    })
  })

  it("rejects invalid form body through the HTTP handler", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/form-schema-invalid"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({
        type: "form",
        validation: { body: messageSchema },
        handler: async ({ request }) => ({ message: request.body.message }),
      }),
    })

    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, { message: "" }, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), {
      ok: false,
      errors: { _form: "Invalid input" },
    })
  })

  it("accepts valid form fields through the HTTP handler (enhanced JSON)", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/form-schema-valid"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({
        type: "form",
        validation: { body: messageSchema },
        handler: async ({ request }) => ({ message: request.body.message }),
      }),
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
      submit: action({
        type: "form",
        validation: { body: contactSchema },
        handler: async ({ request }) => ({
          email: request.body.email,
          hasAvatar: request.body.avatar instanceof File,
          avatarName: request.body.avatar?.name,
        }),
      }),
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

    const formRef = action({ type: "form", handler: async () => {
      callbackInvoked = true
      return { success: true }
    },
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

    const action1 = action({ type: "form", handler: async () => {
      action1Invoked = true
      return { action: "action1" }
    },
    })

    const action2 = action({ type: "form", handler: async () => {
      action2Invoked = true
      return { action: "action2" }
    },
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

    const firstAction = action({ type: "form", handler: async () => {
      firstCallbackInvoked = true
      return { version: "first" }
    },
    })

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      [actionName]: firstAction,
    })

    const secondAction = action({ type: "form", handler: async () => {
      secondCallbackInvoked = true
      return { version: "second" }
    },
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
      testAction: action({ type: "form", handler: async () => {
        invoked = true
        return { success: true }
      },
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
      testAction: action({ type: "form", handler: async () => {
        invoked = true
        return { success: true }
      },
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
      testAction: action({ type: "form", handler: async () => {
        return { success: true }
      },
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
      testAction: action({ type: "form", handler: async () => {
        return { success: true }
      },
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
      testAction: action({ type: "form", handler: async ({ context, signal, request }) => {
        receivedContext = { context, signal, requestHeaders: request.headers }
        return { success: true }
      },
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
    assert.ok(receivedContext && typeof receivedContext === "object")
    const handlerCtx = receivedContext as {
      context: typeof expectedContext
      signal: AbortSignal
      requestHeaders: Record<string, string>
    }
    assert.deepStrictEqual(handlerCtx.context, expectedContext)
    assert.strictEqual(handlerCtx.signal, req.signal)
    assert.ok(handlerCtx.requestHeaders)
  })

  it("should return null when action query parameter is missing", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/no-action"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      testAction: action({ type: "form", handler: async () => {
        return { success: true }
      },
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
      testAction: action({ type: "form", handler: async () => {
        return { success: true }
      },
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
      otherAction: action({ type: "form", handler: async () => {
        return { success: true }
      },
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
      go: action({ type: "form", handler: async () => redirect(303, "/hello") }),
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
      go: action({ type: "form", handler: async () => redirect(303, "/hello") }),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      contentType: "application/x-www-form-urlencoded",
    })
    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 303)
    assert.strictEqual(res.headers.get("location"), "/hello")
  })

  it("native POST redirect includes Set-Cookie from redirect options", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/redirect-cookie-native"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action({
        type: "form",
        handler: async () =>
          redirect(303, "/hello", {
            cookies: [
              { name: "session", value: "abc", path: "/", maxAge: 3600, sameSite: "Lax" },
            ],
          }),
      }),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      contentType: "application/x-www-form-urlencoded",
    })
    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 303)
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")!]
    assert.ok(cookies.some((c) => c.includes("session=abc")))
  })

  it("enhanced POST redirect puts Set-Cookie on response, not JSON body", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/redirect-cookie-enhanced"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action({
        type: "form",
        handler: async () =>
          redirect(303, "/hello", {
            cookies: [{ name: "session", value: "xyz", path: "/" }],
          }),
      }),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.ok(res)
    assert.strictEqual(res.status, 200)
    const body = JSON.parse(await res.text())
    assert.strictEqual(body.location, "/hello")
    assert.strictEqual(body.cookies, undefined)
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")!]
    assert.ok(cookies.some((c) => c.includes("session=xyz")))
  })

  it("enhanced POST sets cookies via handler scope and returns JSON body", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/action-result-enhanced"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action({
        type: "form",
        handler: async ({ response }) => {
          response.cookies.set("sid", "1", { path: "/" })
          return { saved: true }
        },
      }),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.ok(res)
    assert.deepStrictEqual(await res.json(), { saved: true })
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")!]
    assert.ok(cookies.some((c) => c.includes("sid=1")))
  })

  it("redirect with context emits x-kiru-token on enhanced response", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/redirect-token-enhanced"
    const fresh = { user: { id: "u1" } }

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      go: action({
        type: "form",
        handler: async () => redirect(303, "/app", { context: fresh }),
      }),
    })

    const req = makeFormRequest(`${routeId}:go`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.ok(res)
    const token = res.headers.get(KIRU_TOKEN_RESPONSE_HEADER)
    assert.ok(token)
    assert.deepStrictEqual(unwrapKiruToken(token!, SECRET), fresh)
  })
})

describe("action.post (form) / error handling", () => {
  it("returns handler validation JSON for enhanced POST", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/form-validation-enhanced"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({
        type: "form",
        handler: async () => ({
          ok: false as const,
          errors: { message: "Required" },
        }),
      }),
    })

    const req = makeFormRequest(`${routeId}:submit`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), {
      ok: false,
      errors: { message: "Required" },
    })
  })

  it("maps thrown RemoteError to HTTP status for enhanced POST", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const routeId = "test/form-remote-err-migrate"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => {
        throw new RemoteError("Message required", "VALIDATION_ERROR", {
          status: 422,
          details: { fieldErrors: { message: "Required" } },
        })
      },
      }),
    })

    const req = makeFormRequest(`${routeId}:submit`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.strictEqual(res?.status, 422)
    assert.strictEqual(await res?.text(), "")
  })

  it("returns RemoteError HTTP status for enhanced POST when exposeErrors is false", async () => {
    const handler = createRemoteActionHandler(SECRET)
    const routeId = "test/form-validation-hidden"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => {
        throw new RemoteError("nope", "VALIDATION_ERROR", {
          status: 422,
          details: { fieldErrors: { message: "Required" } },
        })
      },
      }),
    })

    const req = makeFormRequest(`${routeId}:submit`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.strictEqual(res?.status, 422)
    assert.strictEqual(await res?.text(), "")
  })

  it("returns 500 for enhanced POST on generic Error", async () => {
    const handler = createRemoteActionHandler(SECRET, { exposeErrors: true })
    const routeId = "test/form-generic-error"

    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => {
        throw new Error("boom")
      },
      }),
    })

    const req = makeFormRequest(`${routeId}:submit`, validToken(), {}, {
      enhanced: true,
    })
    const res = await handler(req)

    assert.strictEqual(res?.status, 500)
  })
})

describe("action.post (form) / origin validation", () => {
  it("403 when allowedOrigins is set and Origin header mismatches", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["https://trusted.example"],
    })
    const routeId = "test/form-origin-block"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => ({ ok: true }) }),
    })
    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, {}, {
      origin: "http://evil.com",
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 403)
  })

  it("allows form POST when Origin matches allowedOrigins", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["http://localhost"],
    })
    const routeId = "test/form-origin-ok"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => ({ ok: true }) }),
    })
    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, {}, {
      origin: "http://localhost",
      enhanced: true,
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { ok: true })
  })

  it("allows form POST when Referer matches allowedOrigins (no Origin)", async () => {
    const handler = createRemoteActionHandler(SECRET, {
      allowedOrigins: ["https://app.example.com"],
    })
    const routeId = "test/form-referer-ok"
    __INTERNAL_REMOTE_REGISTRY.register(routeId, {
      submit: action({ type: "form", handler: async () => ({ via: "referer" }) }),
    })
    const token = validToken()
    const req = makeFormRequest(`${routeId}:submit`, token, {}, {
      referer: "https://app.example.com/page",
      enhanced: true,
    })
    const res = await handler(req)
    assert.strictEqual(res?.status, 200)
    assert.deepStrictEqual(await res?.json(), { via: "referer" })
  })
})

describe("action.post (form) / context injection", () => {
  // Tests for request context handling
})
