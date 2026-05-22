import { action } from "kiru/remote"

export default {
  getEcho: action.get(async ({ context }) => {
    return `literal-default:${context.user?.name ?? "unknown"}`
  }),
}
