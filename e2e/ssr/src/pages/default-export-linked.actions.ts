import { action } from "kiru/remote"

const catalog = {
  getEcho: action.get(async ({ context }) => {
    return `linked-default:${context.user?.name ?? "unknown"}`
  }),
}

export default catalog

export const runPipeline = action.post(async () => {
  const echo = await catalog.getEcho()
  return { echo, linked: true }
})
