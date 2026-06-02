import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { action, KIRU_FORM_TOKEN_FIELD } from "../../remote/index.js"
import { KIRU_TOKEN_RESPONSE_HEADER } from "../../remote/actionResponse.js"
import { requestToken } from "../../globals.js"
import { createFormController } from "../../remote/formController.js"
import { buildActionRpcUrl } from "../../router/rpcUrl.js"
import { registerKiruRouter } from "../../router/routerGlobal.js"
import type { Router } from "../../router/routerInstance.js"
import { withJSDOM } from "./jsdom.js"

/** Node's built-in FormData cannot read JSDOM forms; use the window implementation. */
function useJSDOMFormData(): () => void {
  const prev = globalThis.FormData
  globalThis.FormData = window.FormData as typeof FormData
  return () => {
    globalThis.FormData = prev
  }
}

async function dispatchSubmit(
  form: HTMLFormElement,
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void | Promise<void>,
  options?: { defaultPrevented?: boolean }
) {
  const event = new Event("submit", {
    bubbles: true,
    cancelable: true,
  }) as Kiru.SubmitEvent<HTMLFormElement>
  Object.defineProperty(event, "currentTarget", {
    value: form,
    enumerable: true,
  })
  Object.defineProperty(event, "target", { value: form, enumerable: true })
  if (options?.defaultPrevented) {
    event.preventDefault()
  }
  await onsubmit(event)
}

describe("createFormController", () => {
  const prevFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = prevFetch
    delete (globalThis as Record<string, unknown>).__kiru_router
  })

  it("initializes action URL, method, and signals", async () => {
    await withJSDOM(async () => {
      const ref = action({ type: "form", handler: async () => ({ ok: true }) })
      const ctrl = createFormController(ref)

      assert.equal(ctrl.action, buildActionRpcUrl(ref.__kiruFormActionId))
      assert.equal(ctrl.method, "POST")
      assert.equal(ctrl.result.value, null)
      assert.equal(ctrl.error.value, null)
      assert.equal(ctrl.isPending.value, false)
    })
  })

  it("submits with enhanced headers and updates result on success", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({ message: "hi" }) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      form.innerHTML = '<input name="message" value="hi" />'
      document.body.appendChild(form)

      let capturedUrl = ""
      let capturedInit: RequestInit = {}
      globalThis.fetch = async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init ?? {}
        return new Response(JSON.stringify({ message: "hi" }), { status: 200 })
      }

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(capturedUrl, ctrl.action)
      assert.equal(capturedInit.method, "POST")
      const headers = capturedInit.headers as Record<string, string>
      assert.equal(headers.Accept, "application/json")
      assert.equal(headers["x-kiru-form"], "1")
      assert.deepEqual(ctrl.result.value, { message: "hi" })
      assert.equal(ctrl.isPending.value, false)
      restoreFormData()
      form.remove()
    })
  })

  it("sets isPending while fetch is in flight", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      let resolveFetch!: (value: Response) => void
      globalThis.fetch = () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })

      const pending = dispatchSubmit(form, ctrl.onsubmit)
      await new Promise((r) => setTimeout(r, 0))
      assert.equal(ctrl.isPending.value, true)

      resolveFetch(new Response(JSON.stringify({}), { status: 200 }))
      await pending
      assert.equal(ctrl.isPending.value, false)
      restoreFormData()
      form.remove()
    })
  })

  it("clears result and error when a new submit starts", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      ctrl.result.value = { message: "old" }
      ctrl.error.value = "old error"

      let resolveFetch!: (value: Response) => void
      globalThis.fetch = () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })

      const pending = dispatchSubmit(form, ctrl.onsubmit)
      await new Promise((r) => setTimeout(r, 0))

      assert.equal(ctrl.result.value, null)
      assert.equal(ctrl.error.value, null)

      resolveFetch(new Response(JSON.stringify({}), { status: 200 }))
      await pending
      restoreFormData()
      form.remove()
    })
  })

  it("assigns validation result from handler JSON without throwing", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ ok: false, errors: { message: "Required" } }),
          { status: 200 }
        )

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.deepEqual(ctrl.result.value, {
        ok: false,
        errors: { message: "Required" },
      })
      assert.equal(ctrl.error.value, null)
      assert.equal(ctrl.isPending.value, false)
      restoreFormData()
      form.remove()
    })
  })

  it("sets error signal on non-2xx without throwing", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      globalThis.fetch = async () => new Response(null, { status: 500 })

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(ctrl.result.value, null)
      assert.equal(ctrl.error.value, "Form action failed")
      assert.equal(ctrl.isPending.value, false)
      restoreFormData()
      form.remove()
    })
  })

  it("leaves result null when response is a redirect payload", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            __kiruRedirect: true,
            status: 303,
            location: "/hello",
          }),
          { status: 200 }
        )

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(ctrl.result.value, null)
      assert.equal(ctrl.isPending.value, false)
      restoreFormData()
      form.remove()
    })
  })

  it("uses base-aware action URL when router is mounted under /app", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      registerKiruRouter({ baseUrl: "/app" } as unknown as Router)
      const ref = action({ type: "form", handler: async () => ({ ok: true }) })
      const ctrl = createFormController(ref)
      assert.equal(
        ctrl.action,
        buildActionRpcUrl(ref.__kiruFormActionId, "/app")
      )

      const form = document.createElement("form")
      document.body.appendChild(form)

      let capturedUrl = ""
      globalThis.fetch = async (input) => {
        capturedUrl = String(input)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(capturedUrl, buildActionRpcUrl(ref.__kiruFormActionId, "/app"))
      restoreFormData()
      form.remove()
    })
  })

  it("applies x-kiru-invalidate via registered router", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      const invalidated: string[][] = []
      registerKiruRouter({
        invalidate: async ({ routeIds }: { routeIds: string[] }) => {
          invalidated.push([...routeIds])
        },
      } as unknown as Router)

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "x-kiru-invalidate": "route-a, route-b" },
        })

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.deepEqual(invalidated, [["route-a", "route-b"]])
      restoreFormData()
      form.remove()
    })
  })

  it("applies x-kiru-token from action response via requestToken.setCurrent", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      requestToken.setCurrent("old-token")
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { [KIRU_TOKEN_RESPONSE_HEADER]: "fresh-token" },
        })

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(requestToken.current, "fresh-token")
      requestToken.setCurrent("")
      restoreFormData()
      form.remove()
    })
  })

  it("injects request token when form omits __kiru_token", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      requestToken.setCurrent("")
      const script = document.createElement("script")
      script.setAttribute("k-request-token", "")
      script.textContent = "signed-token"
      document.head.appendChild(script)

      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      form.innerHTML = '<input name="message" value="x" />'
      document.body.appendChild(form)

      let tokenInBody = ""
      globalThis.fetch = async (_input, init) => {
        const fd = init?.body as FormData
        tokenInBody = String(fd.get(KIRU_FORM_TOKEN_FIELD))
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(tokenInBody, "signed-token")
      restoreFormData()
      form.remove()
    })
  })

  it("does not overwrite an existing __kiru_token in the form", async () => {
    await withJSDOM(async () => {
      const restoreFormData = useJSDOMFormData()
      const script = document.createElement("script")
      script.setAttribute("k-request-token", "")
      script.textContent = "from-head"
      document.head.appendChild(script)

      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      form.innerHTML = `<input type="hidden" name="${KIRU_FORM_TOKEN_FIELD}" value="from-form" />`
      document.body.appendChild(form)

      let tokenInBody = ""
      globalThis.fetch = async (_input, init) => {
        const fd = init?.body as FormData
        tokenInBody = String(fd.get(KIRU_FORM_TOKEN_FIELD))
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await dispatchSubmit(form, ctrl.onsubmit)

      assert.equal(tokenInBody, "from-form")
      restoreFormData()
      form.remove()
    })
  })

  it("skips enhanced submit when defaultPrevented", async () => {
    await withJSDOM(async () => {
      const ref = action({ type: "form", handler: async () => ({}) })
      const ctrl = createFormController(ref)
      const form = document.createElement("form")

      let fetchCalled = false
      globalThis.fetch = async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      }

      await dispatchSubmit(form, ctrl.onsubmit, { defaultPrevented: true })

      assert.equal(fetchCalled, false)
    })
  })
})
