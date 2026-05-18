import { formAction } from "kiru/remote"
import { bumpRevalidateGeneration } from "./revalidate-demo.state.js"

export const bump = formAction(
  async () => {
    bumpRevalidateGeneration()
    return { ok: true }
  },
  {
    revalidate: {
      paths: ["/revalidate-demo"],
      tags: ["revalidate-demo"],
    },
  }
)
