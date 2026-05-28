import {
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type KiruRedirect,
  type RemoteFormActionFunction,
  type FormActionClientOutput,
} from "./action.js"
import { signal, type Signal } from "../signals/index.js"
import { requestToken } from "../globals.js"
import { applyActionResponseHeaders } from "../router/routerGlobal.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { REMOTE_ACTION_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"
import { traceReadiness } from "../hydration.js"
import { isBrowser } from "../env.js"

export type { FormActionClientOutput } from "./action.js"

export type CreateFormControllerResult<Output> = {
  action: string
  method: "POST"
  result: Signal<FormActionClientOutput<Output> | null>
  error: Signal<string | null>
  isPending: Signal<boolean>
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void | Promise<void>
}

export function createFormController<Output>(
  ref: RemoteFormActionFunction<Output>
): CreateFormControllerResult<Output> {
  const result = signal<FormActionClientOutput<Output> | null>(null)
  const error = signal<string | null>(null)
  const isPending = signal(false)
  const action = `/?action=${encodeURIComponent(ref.__kiruFormActionId)}`

  const submitEnhanced = async (form: HTMLFormElement) => {
    if (__DEV__ && __KIRU_PURE_CLIENT__) {
      throw new Error(REMOTE_ACTION_PURE_CLIENT_DEV_MSG)
    }
    if (isBrowser) {
      traceReadiness("form", {
        phase: "submit-start",
        actionId: ref.__kiruFormActionId,
      })
    }
    isPending.set(true)
    result.set(null)
    error.set(null)
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
      applyActionResponseHeaders(res.headers)

      if (!res.ok) {
        error.set("Form action failed")
        return
      }

      const text = await res.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text) as unknown
        } catch {
          error.set("Form action failed")
          return
        }
      }

      if (isKiruRedirect(data)) {
        if (isBrowser) {
          traceReadiness("form", {
            phase: "redirect",
            actionId: ref.__kiruFormActionId,
            location: (data as KiruRedirect).location,
          })
        }
        window.location.assign(
          new URL((data as KiruRedirect).location, window.location.href).href
        )
        return
      }

      if (isBrowser) {
        const payload = data as FormActionClientOutput<Output>
        traceReadiness("form", {
          phase: "result",
          actionId: ref.__kiruFormActionId,
          ok:
            payload != null &&
            typeof payload === "object" &&
            "ok" in payload
              ? String((payload as { ok: unknown }).ok)
              : "unknown",
        })
      }
      result.set(data as FormActionClientOutput<Output>)
    } finally {
      isPending.set(false)
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
    error,
    isPending,
    onsubmit: onSubmit,
    method: "POST",
  }
}
