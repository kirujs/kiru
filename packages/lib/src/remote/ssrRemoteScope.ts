import type { CustomRequestContext } from "../router/types.js"
import { staticLoaderSignal } from "../router/navigationScope.js"

export type SsrActionStoreEntry = {
  context: CustomRequestContext
  signal: AbortSignal
}

const emptyContext = (
  signal: AbortSignal = staticLoaderSignal()
): SsrActionStoreEntry => ({
  context: {},
  signal,
})

/** Active scope during sync render; unset outside `runWithSsrRemoteContext`. */
let current: SsrActionStoreEntry | undefined

export function hasSsrActionScope(): boolean {
  return current !== undefined
}

export function getSsrActionContext(): SsrActionStoreEntry {
  return current ?? emptyContext()
}

/** SSR scope entry when inside sync render; undefined outside. */
export function getSsrRemoteScopeEntry(): SsrActionStoreEntry | undefined {
  return current
}

/** Active SSR render/request abort signal when inside {@link runWithSsrRemoteContext}. */
export function getSsrRenderAbortSignal(): AbortSignal | undefined {
  return current?.signal
}

/**
 * Run synchronous render work (e.g. `headlessRender`) with action/request context.
 * Action handlers invoked inside `fn` see this context; RPC handlers use the signed token instead.
 */
export function runWithSsrRemoteContext<T>(
  ctx: CustomRequestContext,
  signal: AbortSignal,
  fn: () => T
): T {
  const prev = current
  current = { context: ctx, signal }
  try {
    return fn()
  } finally {
    current = prev
  }
}
