import {
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  type RemoteFormClientOutput,
} from "./action.js"
import type { RemoteFormMutation } from "./form.js"
import { signal, type Signal } from "../signals/index.js"
import { requestToken } from "../globals.js"
import { applyRemoteResponseHeaders } from "../router/routerGlobal.js"
import { applyRemoteResponsePayload } from "./remoteResponse.js"
import { unwrapPatchedRpcBody } from "./rpcJson.js"
import { buildMutationRpcUrl } from "../router/rpcUrl.js"
import {
  buildRequestedFromTargets,
  wrapFormSubmitResult,
  type MutationResult,
  type QueryUpdateTarget,
} from "./mutationResult.js"
import { KIRU_REQUESTED_QUERIES_FIELD } from "./mutationWire.js"
import { __DEV__, __KIRU_PURE_CLIENT__ } from "../env.js"
import { REMOTE_PURE_CLIENT_DEV_MSG } from "../router/devWarnings.dev.js"

export type { RemoteFormClientOutput } from "./action.js"

export type CreateFormControllerResult<Output> = {
  action: string
  method: "POST"
  result: Signal<RemoteFormClientOutput<Output> | null>
  error: Signal<string | null>
  isPending: Signal<boolean>
  onsubmit: (event: Kiru.SubmitEvent<HTMLFormElement>) => void | Promise<void>
  submit(form: HTMLFormElement): MutationResult<RemoteFormClientOutput<Output> | void>
}

export type CreateFormControllerOptions = {
  /** Default query targets wired on enhanced submit (same as `submit(form).updates(...)`). */
  updates?: QueryUpdateTarget[]
}

export function createFormController<Output>(
  ref: RemoteFormMutation<Output>,
  options?: CreateFormControllerOptions
): CreateFormControllerResult<Output> {
  const result = signal<RemoteFormClientOutput<Output> | null>(null)
  const error = signal<string | null>(null)
  const isPending = signal(false)
  const actionId = ref.__kiruFormMutationId
  const action = buildMutationRpcUrl(actionId)

  const submitEnhanced = async (
    form: HTMLFormElement,
    requestedTargets?: QueryUpdateTarget[],
    opts?: { throwOnError?: boolean }
  ): Promise<RemoteFormClientOutput<Output> | void> => {
    const throwOnError = opts?.throwOnError === true
    if (__DEV__ && __KIRU_PURE_CLIENT__) {
      throw new Error(REMOTE_PURE_CLIENT_DEV_MSG)
    }
    isPending.value = true
    result.value = null
    error.value = null
    const fd = new FormData(form)
    if (!fd.has(KIRU_FORM_TOKEN_FIELD)) {
      fd.set(KIRU_FORM_TOKEN_FIELD, requestToken.current)
    }
    if (requestedTargets?.length) {
      fd.set(
        KIRU_REQUESTED_QUERIES_FIELD,
        JSON.stringify(buildRequestedFromTargets(requestedTargets))
      )
    }
    try {
      const res = await fetch(buildMutationRpcUrl(actionId), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "x-kiru-form": "1",
        },
        body: fd,
      })
      applyRemoteResponseHeaders(res.headers)

      if (!res.ok) {
        error.value = "Form action failed"
        if (throwOnError) throw new Error("Form action failed")
        return
      }

      const text = await res.text()
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text) as unknown
        } catch {
          error.value = "Form action failed"
          if (throwOnError) throw new Error("Form action failed")
          return
        }
      }

      applyRemoteResponsePayload(res.headers, data)

      if (isKiruRedirect(data)) {
        window.location.assign(
          new URL(data.location, window.location.href).href
        )
        return
      }

      const out = unwrapPatchedRpcBody(data) as RemoteFormClientOutput<Output>
      result.value = out
      return out
    } finally {
      isPending.value = false
    }
  }

  const defaultUpdates = options?.updates

  const onSubmit = async (event: Kiru.SubmitEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return
    event.preventDefault()
    await submitEnhanced(event.currentTarget, defaultUpdates)
  }

  const submit = (form: HTMLFormElement) =>
    wrapFormSubmitResult((targets) =>
      submitEnhanced(form, targets, { throwOnError: true })
    )

  return {
    action,
    result,
    error,
    isPending,
    onsubmit: onSubmit,
    submit,
    method: "POST",
  }
}
