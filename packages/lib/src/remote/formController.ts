import {
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type KiruRedirect,
  type RemoteFormActionFunction,
} from "./action.js"
import { signal, type Signal } from "../signals/index.js"
import { requestToken } from "../globals.js"
import { applyInvalidateResponseHeader } from "../router/routerGlobal.js"
import { guardRemoteActionOnClient } from "../router/devWarnings.js"

export type CreateFormControllerResult<Output> = {
  /** Value for the form's `action` attribute (native POST URL). */
  action: string
  method: "POST"
  /**
   * Reactive result of the last submission. Redirects are handled
   * automatically and never appear here — the type excludes {@link KiruRedirect}.
   */
  result: Signal<Exclude<Output, KiruRedirect> | null>
  fieldErrors: Signal<Record<string, string> | null>
  isPending: Signal<boolean>
  /**
   * Attach to the form as `onsubmit={onSubmit}` so fetches return JSON and
   * update `result` / `isPending` while keeping native POST as fallback.
   */
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void
}

/**
 * Wire a {@link formAction} ref to a native `<form>` plus optional
 * `fetch`-based progressive enhancement.
 *
 * When the same page also calls JSON {@link action} stubs, construct the
 * controller from `onMount` so the SSR token is read after the document
 * is ready.
 */
export function createFormController<Output>(
  ref: RemoteFormActionFunction<Output>
): CreateFormControllerResult<Output> {
  const result = signal<Exclude<Output, KiruRedirect> | null>(null)
  const fieldErrors = signal<Record<string, string> | null>(null)
  const isPending = signal(false)
  const action = `/?action=${encodeURIComponent(ref.__kiruFormActionId)}`

  const submitEnhanced = async (form: HTMLFormElement) => {
    guardRemoteActionOnClient()
    isPending.value = true
    result.value = null
    fieldErrors.value = null
    const fd = new FormData(form)
    if (!fd.has(KIRU_FORM_TOKEN_FIELD)) {
      fd.set(KIRU_FORM_TOKEN_FIELD, requestToken.current)
    }
    try {
      const res = await fetch(action, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "x-kiru-form": "1",
        },
        body: fd,
      })
      const text = await res.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text) as unknown
        } catch {
          data = null
        }
      }
      applyInvalidateResponseHeader(res.headers.get("x-kiru-invalidate"))
      if (!res.ok) {
        const fe = fieldErrorsFromRemoteResponse(data)
        if (fe) {
          fieldErrors.value = fe
          return
        }
        throw new Error("Form action failed")
      }
      if (isKiruRedirect(data)) {
        window.location.assign(
          new URL(data.location, window.location.href).href
        )
        return
      }
      result.value = data as Exclude<Output, KiruRedirect>
    } finally {
      isPending.value = false
    }
  }

  const onSubmit = (event: Kiru.SubmitEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return
    event.preventDefault()
    submitEnhanced(event.currentTarget)
  }

  return {
    action,
    result,
    fieldErrors,
    isPending,
    onsubmit: onSubmit,
    method: "POST",
  }
}

export function fieldErrorsFromRemoteResponse(
  data: unknown
): Record<string, string> | null {
  if (!data || typeof data !== "object" || !("error" in data)) return null
  const fe = (data as { error?: { details?: { fieldErrors?: Record<string, string> } } })
    .error?.details?.fieldErrors
  return fe && typeof fe === "object" ? fe : null
}
