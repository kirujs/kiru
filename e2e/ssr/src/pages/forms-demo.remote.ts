import { form, getRequestEvent } from "kiru/remote"

export const submitValidation = form(async () => {
  const { request } = getRequestEvent()
  const message = String(request.formData!.get("message") ?? "").trim()
  if (!message) {
    return { ok: false as const, errors: { message: "Required" } }
  }
  return { ok: true as const, message }
})

export const submitMessage = form(async () => {
  const { request } = getRequestEvent()
  const message = String(request.formData!.get("message") ?? "").trim()
  return { message: message || "empty" }
})

export const submitRedirect = form(async () => {
  const { redirect } = getRequestEvent()
  return redirect(303, "/hello")
})
