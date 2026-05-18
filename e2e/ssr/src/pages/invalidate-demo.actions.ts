import { formAction } from "kiru/remote"

/** Triggers {@link InvalidateDemoPage} to call `router.invalidate()` after submit. */
export const bumpCounter = formAction(async () => ({ ok: true }))
