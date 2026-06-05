import { form, getRequestEvent, query, RemoteError, type Schema } from "kiru/remote"
import { updateUserProfile } from "../server/auth.js"
import { isRecord } from "../types.js"

/** JSON GET — current profile from signed context. */
export const getProfile = query(async () => {
  const { context } = getRequestEvent()
  const user = context.user
  if (!user) {
    throw new RemoteError("Sign in required", "UNAUTHORIZED", { status: 401 })
  }
  return user
})

const profileSchema: Schema<{ name: string; email: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const name = input.name
    const email = input.email
    if (typeof name !== "string" || !name.trim()) throw new Error("Invalid name")
    if (typeof email !== "string" || !email.trim()) throw new Error("Invalid email")
    const trimmedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error("Invalid email")
    }
    return { name: name.trim(), email: trimmedEmail }
  },
}

/** Form POST — update display name and email; refresh signed context. */
export const updateProfile = form(profileSchema, async (input) => {
    const { context } = getRequestEvent()
    const user = context.user
    if (!user) {
      return {
        ok: false as const,
        message: "Sign in required",
      }
    }
    const updated = updateUserProfile(user.id, input)
    if (!updated) {
      return {
        ok: false as const,
        message: "Could not update profile",
      }
    }
    context.user = updated
    return { ok: true as const, user: updated }
})
