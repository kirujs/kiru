import { form, getRequestEvent, query, type Schema } from "kiru/remote"
import {
  clearSessionCookieSpec,
  createSession,
  getSessionIdFromCookieHeader,
  revokeSession,
  sessionCookieSpec,
  updateUserProfile,
  validateCredentials,
  type SandboxUser,
} from "../server/auth.js"
import { isRecord } from "../types.js"

function requireUser(user: SandboxUser | null | undefined): SandboxUser {
  if (!user) throw new Error("UNAUTHORIZED")
  return user
}

/** Signed-in profile for settings page. */
export const getProfile = query(async () => {
  const { context } = getRequestEvent()
  return requireUser(context.user)
})

const profileSchema: Schema<{ name: string; email: string; bio: string; avatarUrl: string }> = {
  parse: (input) => {
    if (!isRecord(input)) throw new Error("Invalid")
    const name = String(input.name ?? "").trim()
    const email = String(input.email ?? "").trim()
    if (!name || !email) throw new Error("Name and email required")
    return {
      name,
      email,
      bio: String(input.bio ?? "").trim(),
      avatarUrl: String(input.avatarUrl ?? "").trim(),
    }
  },
}

export const updateProfile = form(profileSchema, async (data) => {
  const { context } = getRequestEvent()
  const user = requireUser(context.user)
  const updated = updateUserProfile(user.id, data)
  if (!updated) return { ok: false as const, error: "Update failed" }
  context.user = updated
  return { ok: true as const, user: updated }
})

export const login = form(async () => {
  const { request, response, context } = getRequestEvent()
  const username = String(request.formData!.get("username") ?? "").trim()
  const password = String(request.formData!.get("password") ?? "")

  if (!username || !password) {
    return {
      ok: false,
      errors: {
        username: !username ? "Required" : undefined,
        password: !password ? "Required" : undefined,
      },
    }
  }

  const user = validateCredentials(username, password)
  if (!user) {
    return { ok: false, errors: { username: "Unknown user or wrong password" } }
  }

  const sessionId = createSession(user.id)
  const spec = sessionCookieSpec(sessionId)
  response.cookies.set(spec.name, spec.value, spec)
  context.user = user
  return { ok: true as const, user }
})

export const logoutForm = form(async () => {
  const { request, context, response, redirect } = getRequestEvent()
  const sessionId = getSessionIdFromCookieHeader(request.headers.cookie ?? "")
  if (sessionId) revokeSession(sessionId)
  const clear = clearSessionCookieSpec()
  response.cookies.set(clear.name, clear.value, clear)
  context.user = null
  return redirect(303, "/login")
})
