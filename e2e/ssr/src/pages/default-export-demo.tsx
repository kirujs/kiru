import { signal } from "kiru"
import literal from "./default-export-literal.actions.js"
import linked, { runPipeline } from "./default-export-linked.actions.js"

export default function DefaultExportDemoPage() {
  const literalResult = signal("")
  const linkedResult = signal("")
  const composeResult = signal("")

  return () => (
    <section data-testid="default-export-demo">
      <h1>Default export remote actions</h1>

      <button
        data-testid="literal-default-get"
        type="button"
        onclick={async () => {
          try {
            literalResult.set(await literal.getEcho())
          } catch (e) {
            literalResult.set(e instanceof Error ? e.message : "failed")
          }
        }}
      >
        Literal default GET
      </button>
      <p data-testid="literal-default-result">{literalResult}</p>

      <button
        data-testid="linked-default-get"
        type="button"
        onclick={async () => {
          try {
            linkedResult.set(await linked.getEcho())
          } catch (e) {
            linkedResult.set(e instanceof Error ? e.message : "failed")
          }
        }}
      >
        Linked default GET
      </button>
      <p data-testid="linked-default-result">{linkedResult}</p>

      <button
        data-testid="linked-compose-run"
        type="button"
        onclick={async () => {
          try {
            composeResult.set(JSON.stringify(await runPipeline()))
          } catch (e) {
            composeResult.set(e instanceof Error ? e.message : "failed")
          }
        }}
      >
        Linked compose POST
      </button>
      <p data-testid="linked-compose-result">{composeResult}</p>
    </section>
  )
}
