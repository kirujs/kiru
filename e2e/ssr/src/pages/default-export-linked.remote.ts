import { getRequestEvent, mutation, query } from "kiru/remote"

const catalog = {
  getEcho: query(async () => {
    const { context } = getRequestEvent()
    return `linked-default:${context.user?.name ?? "unknown"}`
  }),
}

export default catalog

export const runPipeline = mutation(async () => {
  const echo = await catalog.getEcho()
  return { echo, linked: true }
})
