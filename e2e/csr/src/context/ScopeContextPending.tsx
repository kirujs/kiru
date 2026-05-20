/** Scope-level pending UI (distinct from app `contextPendingFallback` in e2e). */
export default function ScopeContextPending() {
  return <p data-testid="context-pending-scope">Blocking admin area…</p>
}
