import { action } from "kiru/remote"

const catalog = {
  getEcho: action(async ({ context }) => {
    return `linked-default:${context.user?.name ?? "unknown"}`
  }),
  x: action(({body}) => {}),
}

export default catalog

export const runPipeline = action(async () => {
  const echo = await catalog.getEcho()
  return { echo, linked: true }
})
