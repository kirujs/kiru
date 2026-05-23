import { action, RemoteError, type Schema } from "kiru/remote"
import { updateUserProfile } from "../server/auth.js"

/** JSON GET — current profile from signed context. */
export const getProfile = action(async ({ context }) => {
  const user = context.user
  if (!user) {
    throw new RemoteError("Sign in required", "UNAUTHORIZED", { status: 401 })
  }
  return user
})

const profileSchema: Schema<{ name: string; email: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null) throw new Error("Invalid")
    const name = (input as { name?: unknown }).name
    const email = (input as { email?: unknown }).email
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
export const updateProfile = action({
  type: "form",
  validation: { body: profileSchema },
  handler: async ({ body, context }) => {
    const user = context.user
    if (!user) {
      return {
        ok: false as const,
        message: "Sign in required",
      }
    }
    const updated = updateUserProfile(user.id, body)
    if (!updated) {
      return {
        ok: false as const,
        message: "Could not update profile",
      }
    }
    context.user = updated
    return { ok: true as const, user: updated }
  },
})
