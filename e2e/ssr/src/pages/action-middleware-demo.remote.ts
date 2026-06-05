import { getRequestEvent, query, RemoteError } from "kiru/remote"

const HEADER = "x-e2e-action-secret"
const SECRET_VALUE = "open-sesame"

export const gatedEcho = query(async () => {
  const { request } = getRequestEvent()
  if (request.headers[HEADER] !== SECRET_VALUE) {
    throw new RemoteError("Forbidden", "FORBIDDEN", { status: 403 })
  }
  return { echo: SECRET_VALUE }
})

export const authedOnly = query(async () => {
  const { context } = getRequestEvent()
  if (!context.user) {
    throw new RemoteError("Unauthorized", "UNAUTHORIZED", { status: 401 })
  }
  return {
    user: context.user!.name ?? "unknown",
  }
})

export const middlewareHeader = HEADER
export const middlewareHeaderValue = SECRET_VALUE
