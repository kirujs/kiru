import { action } from "kiru/remote"

/** Triggers {@link InvalidateDemoPage} to call `router.invalidate()` after submit. */
export const bumpCounter = action.post({ type: "form" }, async () => ({ ok: true }))
