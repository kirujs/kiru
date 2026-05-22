import { action, fail, redirect } from "kiru/remote"
import {
  clearSessionCookieSpec,
  createSession,
  getSessionIdFromCookieHeader,
  revokeSession,
  sessionCookieSpec,
  validateCredentials,
} from "../server/auth.js"

/** Form action: validate credentials, set session cookie, redirect to todos. */
export const login = action.post({ type: "form" }, async ({ formData }) => {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return fail({
      message: "Invalid login",
      status: 422,
      fields: {
        username: !username ? "Required" : undefined,
        password: !password ? "Required" : undefined,
      },
    })
  }

  const user = validateCredentials(username, password)
  if (!user) {
    return fail({
      message: "Invalid credentials",
      status: 401,
      code: "AUTH_FAILED",
      fields: { username: "Unknown user or wrong password" },
    })
  }

  const sessionId = createSession(user.id)
  return redirect(303, "/todos", {
    cookies: [sessionCookieSpec(sessionId)],
    context: { user },
  })
})

/** Form action: revoke session, clear cookie, redirect to login. */
export const logoutForm = action.post({ type: "form" }, async ({ headers }) => {
  const cookieHeader = headers.cookie ?? headers.Cookie
  const sessionId = getSessionIdFromCookieHeader(cookieHeader)
  if (sessionId) revokeSession(sessionId)
  return redirect(303, "/login", {
    cookies: [clearSessionCookieSpec()],
    context: { user: null },
  })
})
