import { action } from "kiru/remote"

export const echoContextUser = action.get(async ({ context }) => {
  return context.user?.name ?? "none"
})
