import { getRequestEvent, query } from "kiru/remote"

export const echoContextUser = query(async () => {
  const { context } = getRequestEvent()
  return context.user?.name ?? "none"
})
