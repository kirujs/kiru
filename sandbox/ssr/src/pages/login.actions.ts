import { action } from "kiru/remote"
import {
  clearSessionCookieSpec,
  createSession,
  getSessionIdFromCookieHeader,
  revokeSession,
  sessionCookieSpec,
  validateCredentials,
} from "../server/auth.js"

/** Form action: validate credentials, set session cookie, redirect to todos. */
export const login = action({
  type: "form",
  handler: async ({ request, response, context, redirect }) => {
    const username = String(request.formData.get("username") ?? "").trim()
    const password = String(request.formData.get("password") ?? "")

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
      return {
        ok: false,
        errors: {
          username: "Unknown user or wrong password",
        },
      }
    }

    const sessionId = createSession(user.id)
    const spec = sessionCookieSpec(sessionId)
    response.cookies.set(spec.name, spec.value, spec)
    context.user = user
    return redirect(303, "/todos")
  },
})

/** Form action: revoke session, clear cookie, redirect to login. */
export const logoutForm = action({
  type: "form",
  handler: async ({ request, context, response, redirect }) => {
    const cookieHeader = request.headers.cookie ?? ""
    const sessionId = getSessionIdFromCookieHeader(cookieHeader)
    if (sessionId) revokeSession(sessionId)
    const clear = clearSessionCookieSpec()
    response.cookies.set(clear.name, clear.value, clear)
    context.user = null
    return redirect(303, "/login")
  },
})
