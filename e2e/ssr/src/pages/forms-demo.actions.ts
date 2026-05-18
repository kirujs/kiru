import { formAction, redirect, RemoteError } from "kiru/remote"

export const submitValidation = formAction(async (_ctx, formData) => {
  const message = String(formData.get("message") ?? "").trim()
  if (!message) {
    throw new RemoteError("Message required", "VALIDATION_ERROR", {
      status: 422,
      details: { fieldErrors: { message: "Required" } },
    })
  }
  return { message }
})

export const submitMessage = formAction(async (_ctx, formData) => {
  const message = String(formData.get("message") ?? "").trim()
  return { message: message || "empty" }
})

export const submitRedirect = formAction(async () => redirect(303, "/hello"))
