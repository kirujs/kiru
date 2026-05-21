import { signal } from "kiru"
import { api, runPipeline } from "./actions-composition-demo.actions.js"

export default function ActionsCompositionDemoPage() {
  const namespaceGetResult = signal("")
  const composeResult = signal("")
  const deleteResult = signal("")

  return () => (
    <section data-testid="actions-composition-demo">
      <h1>Namespaced &amp; composed actions</h1>
      <button
        data-testid="namespace-get"
        type="button"
        onclick={async () => {
          namespaceGetResult.value = await api.getEcho()
        }}
      >
        Namespace GET
      </button>
      <p data-testid="namespace-get-result">{namespaceGetResult}</p>

      <button
        data-testid="compose-run"
        type="button"
        onclick={async () => {
          const out = await runPipeline()
          composeResult.value = JSON.stringify(out)
        }}
      >
        Run composed pipeline
      </button>
      <p data-testid="compose-result">{composeResult}</p>

      <button
        data-testid="namespace-delete"
        type="button"
        onclick={async () => {
          const out = await api.removeLabel({ input: "demo" })
          deleteResult.value = JSON.stringify(out)
        }}
      >
        Namespace DELETE
      </button>
      <p data-testid="namespace-delete-result">{deleteResult}</p>
    </section>
  )
}
