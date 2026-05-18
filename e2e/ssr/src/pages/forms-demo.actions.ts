import { formAction, redirect } from "kiru/remote"

export const submitMessage = formAction(async (_ctx, formData) => {
  const message = String(formData.get("message") ?? "").trim()
  return { message: message || "empty" }
})

export const submitRedirect = formAction(async () => redirect(303, "/hello"))
