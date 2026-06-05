import { createFormController } from "kiru/remote"
import { defineISR, loader } from "kiru/router"
import { bump } from "./revalidate-demo.remote.js"
import { getRevalidateGeneration } from "./revalidate-demo.state.js"

export const isr = defineISR({
  revalidate: 1,
  tags: ["revalidate-demo"],
})

export const load = loader(async () => ({
  generation: getRevalidateGeneration(),
}))

export default function RevalidateDemo({
  data,
}: {
  data: { generation: number }
}) {
  const form = createFormController(bump)

  return () => (
    <main data-testid="revalidate-demo">
      <h1>Revalidate demo</h1>
      <p data-testid="revalidate-generation">{data.generation}</p>
      <form
        data-testid="revalidate-form"
        action={form.action}
        method={form.method}
        onsubmit={form.onsubmit}
      >
        <button data-testid="revalidate-bump" type="submit">
          Bump & revalidate
        </button>
      </form>
    </main>
  )
}
