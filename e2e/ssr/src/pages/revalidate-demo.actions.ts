import { action } from "kiru/remote"
import { bumpRevalidateGeneration } from "./revalidate-demo.state.js"

export const bump = action.post(
  {
    type: "form",
    revalidate: {
      paths: ["/revalidate-demo"],
      tags: ["revalidate-demo"],
    },
  },
  async () => {
    bumpRevalidateGeneration()
    return { ok: true }
  }
)
