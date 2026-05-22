import { action, actionResult, fail, type Schema } from "kiru/remote"
import type { SandboxUser } from "../server/auth.js"
import { updateUserProfile } from "../server/auth.js"

/** JSON GET — current profile from signed context. */
export const getProfile = action.get(async ({ context }) => {
  const user = context.user
  if (!user) {
    return fail({ message: "Sign in required", status: 401, code: "UNAUTHORIZED" })
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
export const updateProfile = action.post(
  { type: "form", schema: profileSchema },
  async ({ body, context }) => {
    const user = context.user
    if (!user) {
      return fail({ message: "Sign in required", status: 401, code: "UNAUTHORIZED" })
    }
    const updated = updateUserProfile(user.id, body)
    if (!updated) {
      throw new Error("Could not update profile")
    }
    return actionResult(
      { ok: true as const, user: updated },
      { context: { user: updated } }
    )
  }
)
