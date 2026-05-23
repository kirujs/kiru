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
          try {
            namespaceGetResult.value = await api.getEcho()
          } catch (e) {
            namespaceGetResult.value = e instanceof Error ? e.message : "failed"
          }
        }}
      >
        Namespace GET
      </button>
      <p data-testid="namespace-get-result">{namespaceGetResult}</p>

      <button
        data-testid="compose-run"
        type="button"
        onclick={async () => {
          try {
            composeResult.value = JSON.stringify(await runPipeline())
          } catch (e) {
            composeResult.value = e instanceof Error ? e.message : "failed"
          }
        }}
      >
        Run composed pipeline
      </button>
      <p data-testid="compose-result">{composeResult}</p>

      <button
        data-testid="namespace-delete"
        type="button"
        onclick={async () => {
          try {
            deleteResult.value = JSON.stringify(
              await api.removeLabel({ body: "demo" })
            )
          } catch (e) {
            deleteResult.value = e instanceof Error ? e.message : "failed"
          }
        }}
      >
        Namespace DELETE
      </button>
      <p data-testid="namespace-delete-result">{deleteResult}</p>
    </section>
  )
}
