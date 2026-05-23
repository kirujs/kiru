import { action, ActionMiddleware, RemoteError } from "kiru/remote"

const HEADER = "x-e2e-action-secret"
const SECRET_VALUE = "open-sesame"

const requireHeader: ActionMiddleware = ({ request }) => {
  if (request.headers[HEADER] !== SECRET_VALUE) {
    throw new RemoteError("Forbidden", "FORBIDDEN", { status: 403 })
  }
}

const requireUser: ActionMiddleware = ({ context }) => {
  if (!context.user) {
    throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
  }
}

export const gatedEcho = action({
  middleware: [requireHeader],
  handler: async ({ request }) => ({ echo: request.headers[HEADER] ?? "" }),
})

export const authedOnly = action({
  middleware: [requireUser],
  handler: async ({ context }) => ({ user: context.user!.name ?? "unknown" }),
})

export const middlewareHeader = HEADER
export const middlewareHeaderValue = SECRET_VALUE
