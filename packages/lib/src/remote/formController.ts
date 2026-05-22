import {
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type KiruRedirect,
  type RemoteFormActionFunction,
  type UnwrapKiruActionOutput,
} from "./action.js"
import {
  isKiruActionFail,
  sanitizeFailFields,
  type KiruActionFail,
} from "./actionFail.js"
import { signal, type Signal } from "../signals/index.js"
import { requestToken } from "../globals.js"
import { applyActionResponseHeaders } from "../router/routerGlobal.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { REMOTE_ACTION_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"

/** Client-visible form action output (unwraps transport wrappers). */
export type FormActionClientOutput<T> = UnwrapKiruActionOutput<
  Exclude<T, KiruRedirect | KiruActionFail>
>

export type CreateFormControllerResult<Output> = {
  /** Value for the form's `action` attribute (native POST URL). */
  action: string
  method: "POST"
  /**
   * Reactive result of the last submission. Redirects and {@link fail} outcomes
   * are handled automatically and never appear here.
   */
  result: Signal<FormActionClientOutput<Output> | null>
  fieldErrors: Signal<Record<string, string> | null>
  /** Non-field failure message (e.g. auth banner) from {@link fail}. */
  message: Signal<string | null>
  isPending: Signal<boolean>
  /**
   * Attach to the form as `onsubmit={onSubmit}` so fetches return JSON and
   * update `result` / `isPending` while keeping native POST as fallback.
   */
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void | Promise<void>
}

/**
 * Wire an `action.post({ type: "form" }, …)` ref to a native `<form>` plus optional
 * `fetch`-based progressive enhancement.
 *
 * When the same page also calls JSON {@link action} stubs, construct the
 * controller from `onMount` so the SSR token is read after the document
 * is ready.
 */
export function createFormController<Output>(
  ref: RemoteFormActionFunction<Output>
): CreateFormControllerResult<Output> {
  const result = signal<FormActionClientOutput<Output> | null>(null)
  const fieldErrors = signal<Record<string, string> | null>(null)
  const message = signal<string | null>(null)
  const isPending = signal(false)
  const action = `/?action=${encodeURIComponent(ref.__kiruFormActionId)}`

  const submitEnhanced = async (form: HTMLFormElement) => {
    if (__DEV__ && __KIRU_PURE_CLIENT__) {
      throw new Error(REMOTE_ACTION_PURE_CLIENT_DEV_MSG)
    }
    isPending.value = true
    result.value = null
    fieldErrors.value = null
    message.value = null
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
      applyActionResponseHeaders(res.headers)

      if (isKiruActionFail(data)) {
        fieldErrors.value = sanitizeFailFields(data.fields) ?? null
        message.value = data.message
        return
      }

      if (isKiruRedirect(data)) {
        window.location.assign(
          new URL(data.location, window.location.href).href
        )
        return
      }

      if (!res.ok) {
        const fe = fieldErrorsFromRemoteResponse(data)
        if (fe) {
          fieldErrors.value = fe
          const legacyMsg = legacyMessageFromRemoteResponse(data)
          if (legacyMsg) message.value = legacyMsg
          return
        }
        throw new Error("Form action failed")
      }

      result.value = data as FormActionClientOutput<Output>
    } finally {
      isPending.value = false
    }
  }

  const onSubmit = (event: Kiru.SubmitEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return
    event.preventDefault()
    return submitEnhanced(event.currentTarget)
  }

  return {
    action,
    result,
    fieldErrors,
    message,
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

function legacyMessageFromRemoteResponse(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("error" in data)) return null
  const msg = (data as { error?: { message?: string } }).error?.message
  return typeof msg === "string" ? msg : null
}
