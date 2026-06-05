import { form, getRequestEvent } from "kiru/remote"

const messageSchema = {
  parse: (input: unknown) => {
    if (typeof input !== "object" || input === null || !("message" in input)) {
      throw new Error("invalid")
    }
    const message = String((input as { message: unknown }).message ?? "").trim()
    if (!message) throw new Error("Required")
    return { message }
  },
}

export const submitValidation = form(messageSchema, async (input) => ({
  message: input.message,
}))

export const submitMessage = form(async () => {
  const { request } = getRequestEvent()
  const message = String(request.formData!.get("message") ?? "").trim()
  return { message: message || "empty" }
})

export const submitRedirect = form(async () => {
  const { redirect } = getRequestEvent()
  return redirect(303, "/hello")
})
