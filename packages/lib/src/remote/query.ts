import type { InferSchemaOutput, Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import { RemoteError } from "./errors.js"
import {
  createRemoteExecutionForRequest,
  getRemoteExecutionContext,
  getActiveRemoteContext,
  runInRemoteExecution,
  runWithRemoteFrame,
} from "./remoteInvokeScope.js"
import {
  getSsrRemoteScopeEntry,
} from "./ssrRemoteScope.js"
import { buildRemoteHandlerArgs } from "./action.js"
import {
  runWithRemoteResponseScope,
  type HandlerWithScopeResult,
} from "./remoteResponseScope.js"
import type { RemoteInvokeArgs } from "./action.js"
import {
  peelRemoteCallArgs,
  type RemoteCallOptions,
} from "./remoteCallOptions.js"
import {
  runWithRemoteAbortSignalAsync,
  resolveRemoteFetchSignal,
} from "./abortScope.js"
import {
  buildQueryCacheKey,
  clearQueryCachePendingIfMatches,
  getQueryCacheEntryForKey,
  setQueryCacheEntry,
  setQueryCachePending,
} from "./queryCache.js"
import { traceQueryDispatch } from "./queryTrace.dev.js"
import { noteQueryCacheKey } from "./queryCacheTrack.js"
import { dispatchQueryRpc } from "./remoteClientDispatch.js"
import { queueQueryPatch } from "./queryPatch.js"
import { registerQueryInjection } from "../ssr/queryInjection.js"
import { recordQuerySnapshot } from "./querySnapshot.js"
import {
  buildRemoteRequestEvent,
  runWithRemoteRequestEvent,
} from "./remoteRequestEvent.js"

export type RemoteQueryInvokeArgs = RemoteInvokeArgs

export type RemoteQueryHandler<Input, Output> = (
  input: Input
) => Promise<Output> | Output

export type RemoteQueryHandlerVoid<Output> = () => Promise<Output> | Output

export type RemoteQueryBrand = {
  __kiruRemoteQuery: true
  __kiruQueryId?: string
  __kiruQueryVoid?: boolean
  __kiruInvoke: (args: RemoteQueryInvokeArgs) => Promise<HandlerWithScopeResult>
}

export function isRemoteQuery(v: unknown): v is RemoteQuery<unknown, unknown> {
  return (
    typeof v === "function" &&
    v != null &&
    "__kiruRemoteQuery" in v &&
    (v as RemoteQuery<unknown, unknown>).__kiruRemoteQuery === true
  )
}

export type RemoteQueryInstance<Input = unknown, Output = unknown> = {
  readonly input: Input
  readonly __kiruQueryId?: string
  /** Set when built via `.optimistic()` for client-requested wire serialization. */
  readonly __kiruOptimisticOverride?: unknown
  then<TResult1 = Output, TResult2 = never>(
    onfulfilled?:
      | ((value: Output) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
  ): Promise<TResult1 | TResult2>
  refresh(): Promise<Output>
  set(data: Output): void
  optimistic(fn: (current: Output | undefined) => Output): RemoteQueryOverride<
    Input,
    Output
  >
}

/** Cache-bound query handle with an optimistic override for `updates()` wire. */
export type RemoteQueryOverride<Input = unknown, Output = unknown> =
  RemoteQueryInstance<Input, Output> & { readonly __kiruOptimisticOverride: Output }

type RemoteQueryCall<Input, Output> = [Input] extends [void]
  ? (options?: RemoteCallOptions) => Promise<Output>
  : (input: Input, options?: RemoteCallOptions) => Promise<Output>

type RemoteQueryExtras<Input, Output> = [Input] extends [void]
  ? {
      set(data: Output): void
      refresh(): Promise<Output>
      optimistic(fn: (current: Output | undefined) => Output): RemoteQueryOverride<
        void,
        Output
      >
    }
  : { key: (input: Input) => RemoteQueryInstance<Input, Output> }

export type RemoteQuery<Input = void, Output = unknown> = RemoteQueryCall<
  Input,
  Output
> &
  RemoteQueryBrand &
  RemoteQueryExtras<Input, Output>

/** Refresh a query instance named in a client-requested wire entry. */
export function refreshQueryForWireEntry<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: unknown
): Promise<Output> {
  return queryHandleForWireEntry(queryFn, input).refresh() as Promise<Output>
}

/** Cache-bound handle for a wire entry (`requested()` iterator, refresh helpers). */
export function queryHandleForWireEntry<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: unknown
): RemoteQueryInstance<Input, Output> | RemoteQuery<void, Output> {
  if (queryFn.__kiruQueryVoid) {
    return queryFn as unknown as RemoteQuery<void, Output>
  }
  return (
    queryFn as RemoteQuery<Input, Output> & {
      key: (input: Input) => RemoteQueryInstance<Input, Output>
    }
  ).key(input as Input)
}

/** Prevent inference from flowing out of this position (schema drives `Input`). */
type NoInfer<T> = [T][T extends unknown ? 0 : never]

function rejectConfigObject(first: unknown): void {
  if (
    first &&
    typeof first === "object" &&
    "handler" in first
  ) {
    throw new Error(
      "query() no longer accepts config objects — use query(handler) or query(schema, handler)"
    )
  }
}

function resolveInProcessContext():
  | ReturnType<typeof buildRemoteHandlerArgs>
  | undefined {
  const active = getActiveRemoteContext()
  if (active) return active
  const ssr = getSsrRemoteScopeEntry()
  if (ssr) {
    return buildRemoteHandlerArgs(
      ssr.context,
      ssr.signal,
      undefined,
      undefined
    )
  }
  return undefined
}

async function validateInput<Input>(
  schema: Schema<Input> | undefined,
  raw: unknown
): Promise<Input> {
  if (!schema) return undefined as Input
  try {
    return await parseInput(schema, raw)
  } catch {
    throw new RemoteError("Invalid query input", "INVALID_INPUT", { status: 400 })
  }
}

function createQueryInstance<Input, Output>(
  queryFn: RemoteQuery<Input, Output>,
  input: Input,
  options?: RemoteCallOptions,
  capturedInProcess?: ReturnType<typeof buildRemoteHandlerArgs>
): RemoteQueryInstance<Input, Output> {
  const queryId = queryFn.__kiruQueryId ?? ""
  const cacheKey = buildQueryCacheKey(queryId, input as unknown)

  const runFetch = (): Promise<Output> => {
    noteQueryCacheKey(cacheKey)
    const cached = getQueryCacheEntryForKey(cacheKey)
    if (cached?.data !== undefined && !cached.pending) {
      traceQueryDispatch("runFetch", {
        queryId,
        cacheKey,
        path: "cache-data",
        capturedInProcess: !!capturedInProcess,
      })
      if (typeof window === "undefined") {
        registerQueryInjection(queryId, input === undefined ? null : input, {
          ok: true,
          data: cached.data,
        })
      }
      return Promise.resolve(cached.data as Output)
    }
    if (cached?.pending) {
      traceQueryDispatch("runFetch", {
        queryId,
        cacheKey,
        path: "cache-pending",
        capturedInProcess: !!capturedInProcess,
      })
      const pending = cached.pending as Promise<Output>
      return pending.catch((err) => {
        traceQueryDispatch("runFetch:pending-rejected", {
          queryId,
          cacheKey,
          error: err instanceof Error ? err.message : String(err),
        })
        clearQueryCachePendingIfMatches(cacheKey, pending)
        return runFetch()
      })
    }

    const execution = getRemoteExecutionContext()
    const inProcess = capturedInProcess ?? resolveInProcessContext()
    if (inProcess) {
      traceQueryDispatch("runFetch", {
        queryId,
        cacheKey,
        path: "in-process",
        capturedInProcess: !!capturedInProcess,
      })
      return runWithRemoteAbortSignalAsync(inProcess.signal, async () => {
        const body = input === undefined ? null : input
        const signal = resolveRemoteFetchSignal(options) ?? inProcess.signal
        const resolvedExecution =
          execution ??
          createRemoteExecutionForRequest({
            context: inProcess.context,
            signal,
            request: new Request("http://localhost/"),
            headers: new Headers(),
            body,
            query: {},
            entryActionId: queryId,
          })
        const invokeQuery = () =>
          queryFn.__kiruInvoke({
            body,
            query: {},
            context: inProcess.context,
            signal,
            request: resolvedExecution.request.raw,
            execution: resolvedExecution,
          })
        const scoped = execution
          ? await runWithRemoteFrame(queryId, invokeQuery)
          : await runInRemoteExecution(resolvedExecution, () =>
              runWithRemoteFrame(queryId, invokeQuery)
            )
        const handlerResult =
          scoped && typeof scoped === "object" && "handlerResult" in scoped
            ? scoped.handlerResult
            : scoped
        setQueryCacheEntry(cacheKey, handlerResult)
        recordQuerySnapshot(
          queryId,
          input === undefined ? null : input,
          handlerResult
        )
        if (typeof window === "undefined") {
          registerQueryInjection(
            queryId,
            input === undefined ? null : input,
            { ok: true, data: handlerResult }
          )
          queueQueryPatch({
            queryId,
            input: input === undefined ? null : input,
            op: "refresh",
            data: handlerResult,
          })
        }
        return handlerResult as Output
      })
    }

    traceQueryDispatch("runFetch", {
      queryId,
      cacheKey,
      path: "rpc",
      capturedInProcess: !!capturedInProcess,
    })
    let p!: Promise<Output>
    p = (async () => {
      const data = await dispatchQueryRpc(
        queryId,
        input === undefined ? null : input,
        options
      )
      setQueryCacheEntry(cacheKey, data)
      return data as Output
    })().catch((err) => {
      clearQueryCachePendingIfMatches(cacheKey, p)
      throw err
    })
    setQueryCachePending(cacheKey, p)
    return p
  }

  const instance: RemoteQueryInstance<Input, Output> = {
    input: input as Input,
    __kiruQueryId: queryId,
    then(onfulfilled, onrejected) {
      return runFetch().then(onfulfilled, onrejected)
    },
    refresh() {
      return runFetch()
    },
    set(data: Output) {
      setQueryCacheEntry(cacheKey, data)
      if (typeof window === "undefined") {
        queueQueryPatch({
          queryId,
          input: input === undefined ? null : input,
          op: "set",
          data,
        })
      }
    },
    optimistic(fn) {
      const cached = getQueryCacheEntryForKey(cacheKey)
      const next = fn(cached?.data as Output | undefined)
      setQueryCacheEntry(cacheKey, next)
      return { ...instance, __kiruOptimisticOverride: next } as RemoteQueryOverride<
        Input,
        Output
      >
    },
  }
  return instance
}

function createRemoteQuery<Input, Output>(
  options: {
    handler: RemoteQueryHandler<Input, Output> | RemoteQueryHandlerVoid<Output>
    inputSchema?: Schema<Input>
    isVoid: boolean
  }
): RemoteQuery<Input, Output> {
  const { handler, inputSchema, isVoid } = options

  const invoke = async (
    args: RemoteQueryInvokeArgs
  ): Promise<HandlerWithScopeResult> => {
    const execution = args.execution ?? getRemoteExecutionContext()
    if (!execution) {
      throw new Error(
        "Remote query invoke requires RemoteExecution (HTTP entry or runInRemoteExecution)"
      )
    }
    return runWithRemoteResponseScope(execution, async (scope) => {
      const input = await validateInput(inputSchema, args.body)
      const scopedArgs = scope.toHandlerArgs(input, undefined)
      const event = buildRemoteRequestEvent({
        headers: scopedArgs.request.headers,
        body: input,
        context: scopedArgs.context,
        responseHeaders: scopedArgs.response.headers,
        cookies: scopedArgs.response.cookies,
        signal: scopedArgs.signal,
      })
      return runWithRemoteRequestEvent(event, () => {
        if (isVoid) {
          return (handler as RemoteQueryHandlerVoid<Output>)()
        }
        return (handler as RemoteQueryHandler<Input, Output>)(input)
      })
    })
  }

  let queryRef!: RemoteQuery<Input, Output>

  const call = async (...args: unknown[]) => {
    const { callArgs, options } = peelRemoteCallArgs(args)
    const input = (isVoid ? undefined : callArgs[0]) as Input
    const capturedInProcess = resolveInProcessContext()
    traceQueryDispatch("call", {
      queryId: queryRef.__kiruQueryId ?? "",
      capturedInProcess: !!capturedInProcess,
    })
    return createQueryInstance(
      queryRef,
      input,
      options,
      capturedInProcess
    ).then((v) => v)
  }

  const voidInstance = () =>
    createQueryInstance(
      queryRef,
      undefined as Input,
      undefined,
      resolveInProcessContext()
    )

  queryRef = Object.assign(call, {
    __kiruRemoteQuery: true as const,
    __kiruQueryVoid: isVoid,
    __kiruInvoke: invoke,
    ...(isVoid
      ? {
          set(data: Output) {
            voidInstance().set(data)
          },
          refresh() {
            return voidInstance().refresh()
          },
          optimistic(fn: (current: Output | undefined) => Output) {
            return voidInstance().optimistic(fn)
          },
        }
      : {
          key(input: Input) {
            return createQueryInstance(
              queryRef,
              input,
              undefined,
              resolveInProcessContext()
            )
          },
        }),
  }) as unknown as RemoteQuery<Input, Output>

  return queryRef
}

export function query<Output>(
  handler: RemoteQueryHandlerVoid<Output>
): RemoteQuery<void, Output>
export function query<S extends Schema<unknown>, Output>(
  schema: S,
  handler: NoInfer<
    (input: InferSchemaOutput<S>) => Promise<Output> | Output
  >
): RemoteQuery<InferSchemaOutput<S>, Output>
export function query<Input, Output>(
  schema: Schema<Input>,
  handler: RemoteQueryHandler<Input, Output>
): RemoteQuery<Input, Output>
export function query(handlerOrSchema?: unknown, maybeHandler?: unknown) {
  // Overload shim: public overloads erase to a single runtime entry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return queryImpl(handlerOrSchema, maybeHandler) as any
}

function queryImpl(
  handlerOrSchema?: unknown,
  maybeHandler?: unknown
): RemoteQuery<unknown, unknown> {
  if (typeof handlerOrSchema === "function") {
    return createRemoteQuery({
      handler: handlerOrSchema as RemoteQueryHandlerVoid<unknown>,
      isVoid: true,
    }) as RemoteQuery<unknown, unknown>
  }
  rejectConfigObject(handlerOrSchema)
  if (!maybeHandler) {
    throw new Error("query(schema, handler) requires a handler")
  }
  return createRemoteQuery({
    handler: maybeHandler as RemoteQueryHandler<unknown, unknown>,
    inputSchema: handlerOrSchema as Schema<unknown>,
    isVoid: false,
  }) as RemoteQuery<unknown, unknown>
}

/** Client codegen entry — builds callable query with `.key` / `.refresh`. */
export function __$defineQuery<Input, Output>(
  queryId: string,
  isVoid: boolean
): RemoteQuery<Input, Output> {
  const base = createRemoteQuery({
    handler: () => {
      throw new Error("Query handler missing on client bundle")
    },
    isVoid,
  }) as RemoteQuery<Input, Output>
  base.__kiruQueryId = queryId
  return base
}

export type InferQueryInput<T> = T extends RemoteQuery<infer I, unknown>
  ? I
  : unknown

export type InferQueryOutput<T> = T extends RemoteQuery<unknown, infer O>
  ? O
  : unknown
