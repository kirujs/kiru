import { action } from "kiru/remote"
import { bumpRevalidateGeneration } from "./revalidate-demo.state.js"

export const bump = action({
  type: "form",
  revalidate: {
    paths: ["/revalidate-demo"],
    tags: ["revalidate-demo"],
  },
  handler: async () => {
    bumpRevalidateGeneration()
    return { ok: true }
  },
})
