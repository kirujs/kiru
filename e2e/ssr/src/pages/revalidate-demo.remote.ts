import { form } from "kiru/remote"
import { revalidatePath, revalidateTag } from "kiru/router"
import { bumpRevalidateGeneration } from "./revalidate-demo.state.js"

export const bump = form(async () => {
  bumpRevalidateGeneration()
  await revalidatePath("/revalidate-demo")
  await revalidateTag("revalidate-demo")
  return { ok: true }
})
