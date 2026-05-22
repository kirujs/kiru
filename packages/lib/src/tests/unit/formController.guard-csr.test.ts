import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { action } from "../../remote/index.js"
import { createFormController } from "../../remote/formController.js"
import { REMOTE_ACTION_PURE_CLIENT_DEV_MSG } from "../../router/devWarnings.dev.js"
import { withJSDOM } from "./jsdom.js"

async function dispatchSubmit(
  form: HTMLFormElement,
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void | Promise<void>
) {
  const event = new Event("submit", {
    bubbles: true,
    cancelable: true,
  }) as Kiru.SubmitEvent<HTMLFormElement>
  Object.defineProperty(event, "currentTarget", {
    value: form,
    enumerable: true,
  })
  await onsubmit(event)
}

describe("createFormController on csr bundle", () => {
  const prevFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = prevFetch
  })

  it("throws when enhanced submit runs in dev on pure-client bootstrap", async () => {
    await withJSDOM(async () => {
      const prevFormData = globalThis.FormData
      globalThis.FormData = window.FormData as typeof FormData

      const ref = action.post({ type: "form" }, async () => ({}))
      const ctrl = createFormController(ref)
      const form = document.createElement("form")
      document.body.appendChild(form)

      try {
        await assert.rejects(
          () => dispatchSubmit(form, ctrl.onsubmit),
          new RegExp(REMOTE_ACTION_PURE_CLIENT_DEV_MSG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        )
      } finally {
        globalThis.FormData = prevFormData
        form.remove()
      }
    })
  })
})
