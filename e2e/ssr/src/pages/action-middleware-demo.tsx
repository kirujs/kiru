import { signal } from "kiru"
import { authedOnly, gatedEcho } from "./action-middleware-demo.remote.js"

export default function ActionMiddlewareDemoPage() {
  const gatedResult = signal("")
  const gatedDenied = signal("")
  const authResult = signal("")

  return () => (
    <section data-testid="action-middleware-demo">
      <h1>Action middleware demo</h1>
      <button
        data-testid="mw-gated-denied"
        type="button"
        onclick={async () => {
          gatedDenied.value = await gatedEcho()
            .then((res) => JSON.stringify(res))
            .catch((e) => (e instanceof Error ? e.message : "failed"))
        }}
      >
        Gated action (without header)
      </button>
      <p data-testid="mw-gated-denied-result">{gatedDenied}</p>

      <button
        data-testid="mw-gated-allowed"
        type="button"
        onclick={async () => {
          gatedResult.value = await gatedEcho()
            .then((res) => JSON.stringify(res))
            .catch((e) => (e instanceof Error ? e.message : "failed"))
        }}
      >
        Gated action (with header)
      </button>
      <p data-testid="mw-gated-result">{gatedResult}</p>

      <button
        data-testid="mw-auth"
        type="button"
        onclick={async () => {
          authResult.value = await authedOnly()
            .then((res) => JSON.stringify(res))
            .catch((e) => (e instanceof Error ? e.message : "failed"))
        }}
      >
        Auth-only action
      </button>
      <p data-testid="mw-auth-result">{authResult}</p>
    </section>
  )
}
