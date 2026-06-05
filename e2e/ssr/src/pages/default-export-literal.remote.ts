import { getRequestEvent, query } from "kiru/remote"

export default {
  getEcho: query(async () => {
    const { context } = getRequestEvent()
    return `literal-default:${context.user?.name ?? "unknown"}`
  }),
}
