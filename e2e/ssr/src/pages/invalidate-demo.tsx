import { onMount } from "kiru"
import { createFormController } from "kiru/remote"
import { serverLoader, useRouter, type PageProps } from "kiru/router"
import { bumpCounter } from "./invalidate-demo.actions.js"

const LOAD_INVOCATION_KEY = "__kiru_e2e_invalidate_load_invocation__"

function nextLoadGeneration(): number {
  const g = globalThis as Record<string, unknown>
  const n = Number(g[LOAD_INVOCATION_KEY] ?? 0)
  g[LOAD_INVOCATION_KEY] = n + 1
  return n
}

export const load = serverLoader({
  load: async () => ({ generation: nextLoadGeneration() }),
  fallback: () => <p data-testid="invalidate-fallback">Loading…</p>,
})

export default function InvalidateDemoPage() {
  const router = useRouter()
  const form = createFormController(bumpCounter)

  onMount(() =>
    form.result.subscribe((value) => {
      if (value?.ok) void router.invalidate()
    })
  )

  return ({ data }: PageProps<typeof load>) => (
    <section data-testid="invalidate-demo">
      <p data-testid="invalidate-generation">{data?.generation ?? ""}</p>
      <form
        data-testid="invalidate-form"
        action={form.action}
        method={form.method}
        onsubmit={form.onsubmit}
      >
        <button data-testid="invalidate-bump" type="submit">
          Bump
        </button>
      </form>
    </section>
  )
}
