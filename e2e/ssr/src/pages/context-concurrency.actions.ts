import { action } from "kiru/remote"

export const echoContextUser = action(async ({ context }) => {
  return context.user?.name ?? "none"
})
