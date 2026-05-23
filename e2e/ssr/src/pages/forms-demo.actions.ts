import { action } from "kiru/remote"

export const submitValidation = action({
  type: "form",
  handler: async ({ request }) => {
    const message = String(request.formData.get("message") ?? "").trim()
    if (!message) {
      return { ok: false as const, errors: { message: "Required" } }
    }
    return { message }
  },
})

export const submitMessage = action({
  type: "form",
  handler: async ({ request }) => {
    const message = String(request.formData.get("message") ?? "").trim()
    return { message: message || "empty" }
  },
})

export const submitRedirect = action({
  type: "form",
  handler: async ({ redirect }) => redirect(303, "/hello"),
})
