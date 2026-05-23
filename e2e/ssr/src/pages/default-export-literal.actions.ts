import { action } from "kiru/remote"

export default {
  getEcho: action(async ({ context }) => {
    return `literal-default:${context.user?.name ?? "unknown"}`
  }),
}
