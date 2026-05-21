import { action, redirect, RemoteError } from "kiru/remote"

export const submitValidation = action.post(
  { type: "form" },
  async ({ formData }) => {
    const message = String(formData.get("message") ?? "").trim()
    if (!message) {
      throw new RemoteError("Message required", "VALIDATION_ERROR", {
        status: 422,
        details: { fieldErrors: { message: "Required" } },
      })
    }
    return { message }
  }
)

export const submitMessage = action.post(
  { type: "form" },
  async ({ formData }) => {
    const message = String(formData.get("message") ?? "").trim()
    return { message: message || "empty" }
  }
)

export const submitRedirect = action.post({ type: "form" }, async () =>
  redirect(303, "/hello")
)
