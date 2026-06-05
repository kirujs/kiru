import { KIRU_FORM_TOKEN_FIELD } from "./action.js"
import { buildRemoteHttpResponse, normalizeRemoteResult } from "./remoteHttpSerialize.js"
import type { HandlerWithScopeResult } from "./remoteResponseScope.js"
import {
  createRemoteExecutionForRequest,
  runInRemoteExecution,
} from "./remoteInvokeScope.js"
import {
  assertFormFieldCountWithinLimits,
  assertTokenWithinLimits,
  isRequestLimitError,
  readBoundedJson,
  resolveRequestLimits,
  type KiruRequestLimits,
} from "../router/requestLimits.js"
import { isAbortError } from "../router/navigationScope.js"
import { isRemoteError } from "./errors.js"
import { unwrapKiruToken } from "./token.js"
import type { RemoteFormMutation } from "./form.js"
import type { RemoteMutation } from "./mutation.js"
import { isRemoteQuery } from "./query.js"
import type {
  RemoteInvokeArgs,
  RemoteFormInvokeArgs,
} from "./action.js"
export type CreateRemoteHandlerOptions = {
  allowedOrigins?: string[]
  exposeErrors?: boolean
  deployTarget?: import("@kirujs/runtime").KiruDeployTarget
  requestLimits?: Partial<KiruRequestLimits>
}

export type AnyRegisteredRemote = Record<string, unknown>

export function createRemoteRegistry(): {
  register(id: string, fns: Record<string, unknown>): void
  lookup(routeId: string, name: string): unknown
} {
  const registry: Record<string, Record<string, unknown>> = {}
  return {
    register(id, fns) {
      registry[id] = fns
    },
    lookup(routeId, name) {
      return registry[routeId]?.[name]
    },
  }
}

function isAllowedOrigin(
  request: Request,
  allowed: readonly string[]
): boolean {
  if (allowed.length === 0) return true
  if (allowed.includes("*")) return true
  const origin = request.headers.get("origin") ?? ""
  if (origin && allowed.includes(origin)) return true
  const referer = request.headers.get("referer")
  if (!referer) return false
  try {
    const u = new URL(referer)
    const base = `${u.protocol}//${u.host}`
    return allowed.includes(base)
  } catch {
    return false
  }
}

function isRemoteMutation(v: unknown): v is RemoteMutation<unknown, unknown> {
  return (
    !!v &&
    typeof v === "function" &&
    "__kiruRemoteMutation" in v &&
    (v as RemoteMutation<unknown, unknown>).__kiruRemoteMutation === true
  )
}

function isRemoteFormMutation(v: unknown): v is RemoteFormMutation<unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    "__kiruFormMutation" in v &&
    (v as RemoteFormMutation<unknown>).__kiruFormMutation === true
  )
}

async function buildResponseFromInvoke(
  handlerResult: unknown,
  meta: import("./remoteResponseScope.js").CommittedResponseMeta,
  secret: string,
  options: CreateRemoteHandlerOptions | undefined,
  init: { isEnhanced: boolean; referer?: string }
): Promise<Response> {
  const normalized = normalizeRemoteResult(handlerResult, meta)
  return buildRemoteHttpResponse({
    normalized,
    secret,
    deployTarget: options?.deployTarget,
    isEnhanced: init.isEnhanced,
    referer: init.referer,
    committed: meta,
  })
}

async function invokeWithExecution(
  invoke: () => HandlerWithScopeResult | Promise<HandlerWithScopeResult>,
  request: Request,
  secret: string,
  options: CreateRemoteHandlerOptions | undefined,
  responseInit: { isEnhanced: boolean; referer?: string }
): Promise<Response> {
  try {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    const { handlerResult, meta } = await Promise.resolve(invoke())
    return buildResponseFromInvoke(
      handlerResult,
      meta,
      secret,
      options,
      responseInit
    )
  } catch (e) {
    if (isAbortError(e) || request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    if (isRemoteError(e)) {
      return new Response(null, { status: e.status })
    }
    return new Response(null, { status: 500 })
  }
}

function parseRemoteId(param: string | null): { routeId: string; name: string } | null {
  if (!param) return null
  const split = param.indexOf(":")
  if (split < 1) return null
  return {
    routeId: param.slice(0, split),
    name: param.slice(split + 1),
  }
}

export function createRemoteHandler(
  registry: ReturnType<typeof createRemoteRegistry>,
  secret: string,
  options?: CreateRemoteHandlerOptions
): (request: Request) => Promise<Response | null> {
  const limits = resolveRequestLimits(options?.requestLimits)
  return async (request: Request) => {
    try {
      const url = new URL(request.url)
      const queryId = url.searchParams.get("query")
      const mutationId =
        url.searchParams.get("mutation") ?? url.searchParams.get("action")
      const contentType = request.headers.get("content-type") ?? ""

      if (
        mutationId &&
        request.method === "POST" &&
        (contentType.includes("multipart/form-data") ||
          contentType.includes("application/x-www-form-urlencoded"))
      ) {
        const parsed = parseRemoteId(mutationId)
        if (!parsed) return new Response(null, { status: 500 })
        const { routeId, name } = parsed

        const allowed = options?.allowedOrigins
        if (
          allowed &&
          allowed.length > 0 &&
          !isAllowedOrigin(request, allowed)
        ) {
          return new Response(null, { status: 403 })
        }

        let formData: FormData
        try {
          formData = await request.formData()
        } catch {
          return new Response(null, { status: 500 })
        }

        try {
          assertFormFieldCountWithinLimits(formData, limits)
        } catch (e) {
          if (isRequestLimitError(e)) {
            return new Response(null, { status: e.status })
          }
          throw e
        }

        const tokenFromForm = formData.get(KIRU_FORM_TOKEN_FIELD)
        if (typeof tokenFromForm !== "string") {
          return new Response(null, { status: 400 })
        }

        try {
          assertTokenWithinLimits(tokenFromForm, limits)
        } catch (e) {
          if (isRequestLimitError(e)) {
            return new Response(null, { status: e.status })
          }
          throw e
        }

        const context = unwrapKiruToken(tokenFromForm, secret, limits)
        if (!context) return new Response(null, { status: 400 })

        const handler = registry.lookup(routeId, name)
        if (!isRemoteFormMutation(handler)) {
          return new Response(null, { status: 500 })
        }

        const execution = createRemoteExecutionForRequest({
          context,
          signal: request.signal,
          request,
          headers: request.headers,
          body: formData,
          entryActionId: mutationId,
        })
        const formArgs: RemoteFormInvokeArgs = {
          formData,
          signal: execution.request.signal,
        }
        return invokeWithExecution(
          () =>
            runInRemoteExecution(execution, () => handler.__kiruInvoke(formArgs)),
          request,
          secret,
          options,
          {
            isEnhanced: !!request.headers.get("x-kiru-form"),
            referer: request.headers.get("referer") ?? "/",
          }
        )
      }

      if (queryId && request.method === "POST") {
        const parsed = parseRemoteId(queryId)
        if (!parsed) return new Response(null, { status: 500 })
        const token = request.headers.get("x-kiru-token")
        if (!token) return new Response(null, { status: 400 })

        const allowed = options?.allowedOrigins
        if (allowed && allowed.length > 0 && !isAllowedOrigin(request, allowed)) {
          return new Response(null, { status: 403 })
        }

        try {
          assertTokenWithinLimits(token, limits)
        } catch (e) {
          if (isRequestLimitError(e)) {
            return new Response(null, { status: e.status })
          }
          throw e
        }

        const context = unwrapKiruToken(token, secret, limits)
        if (!context) return new Response(null, { status: 400 })

        const handler = registry.lookup(parsed.routeId, parsed.name)
        if (!isRemoteQuery(handler)) {
          return new Response(null, { status: 500 })
        }

        let body: unknown = null
        try {
          body = await readBoundedJson(request, limits.maxJsonBodyBytes)
        } catch (e) {
          if (isRequestLimitError(e)) {
            return new Response(null, { status: e.status })
          }
          body = null
        }

        const execution = createRemoteExecutionForRequest({
          context,
          signal: request.signal,
          request,
          headers: request.headers,
          body,
          query: {},
          entryActionId: queryId,
        })
        const handlerArgs: RemoteInvokeArgs = {
          body,
          query: {},
          context: execution.request.context,
          signal: execution.request.signal,
          request,
          execution,
        }
        return invokeWithExecution(
          () =>
            runInRemoteExecution(execution, () => handler.__kiruInvoke(handlerArgs)),
          request,
          secret,
          options,
          { isEnhanced: true }
        )
      }

      if (!mutationId) return null

      const token = request.headers.get("x-kiru-token")
      if (!token) return null

      const parsed = parseRemoteId(mutationId)
      if (!parsed) return new Response(null, { status: 500 })

      const allowed = options?.allowedOrigins
      if (allowed && allowed.length > 0 && !isAllowedOrigin(request, allowed)) {
        return new Response(null, { status: 403 })
      }

      try {
        assertTokenWithinLimits(token, limits)
      } catch (e) {
        if (isRequestLimitError(e)) {
          return new Response(null, { status: e.status })
        }
        throw e
      }

      const context = unwrapKiruToken(token, secret, limits)
      if (!context) return new Response(null, { status: 400 })

      if (request.method !== "POST") {
        return new Response(null, { status: 405 })
      }

      let body: unknown = null
      try {
        body = await readBoundedJson(request, limits.maxJsonBodyBytes)
      } catch (e) {
        if (isRequestLimitError(e)) {
          return new Response(null, { status: e.status })
        }
        body = null
      }

      const handler = registry.lookup(parsed.routeId, parsed.name)
      if (!isRemoteMutation(handler)) {
        return new Response(null, { status: 500 })
      }

      const execution = createRemoteExecutionForRequest({
        context,
        signal: request.signal,
        request,
        headers: request.headers,
        body,
        query: {},
        entryActionId: mutationId,
      })
      const handlerArgs: RemoteInvokeArgs = {
        body,
        query: {},
        context: execution.request.context,
        signal: execution.request.signal,
        request,
        execution,
      }
      return invokeWithExecution(
        () =>
          runInRemoteExecution(execution, () => handler.__kiruInvoke(handlerArgs)),
        request,
        secret,
        options,
        { isEnhanced: true }
      )
    } catch (e) {
      if (isRequestLimitError(e)) {
        return new Response(null, { status: e.status })
      }
      return new Response(null, { status: 500 })
    }
  }
}
