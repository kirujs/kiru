import type { InferSchemaOutput, Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import { __DEV__ } from "../env.js"
import { renderMode } from "../globals.js"
import { RemoteError } from "./errors.js"
import {
  getRemoteExecutionContext,
  getActiveRemoteContext,
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
import { parseMutationWireBody } from "./mutationWire.js"
import { wrapMutationResult, wrapInProcessMutationResult } from "./mutationResult.js"
import {
  beginRequestedScope,
  endRequestedScope,
} from "./requestedScope.js"
import { beginQueryPatchCollector, endQueryPatchCollector } from "./queryPatch.js"
import { attachQueryPatchesToPayload } from "./remoteResponse.js"
import type { KiruRemoteServerResult } from "./remoteHandlerTypes.js"
import {
  buildRemoteRequestEvent,
  runWithRemoteRequestEvent,
} from "./remoteRequestEvent.js"

export type RemoteMutationInvokeArgs = RemoteInvokeArgs

export type RemoteMutationHandler<Input, Output> = (
  input: Input
) => Promise<KiruRemoteServerResult<Output>> | KiruRemoteServerResult<Output>

export type RemoteMutationHandlerVoid<Output> = () =>
  Promise<KiruRemoteServerResult<Output>> | KiruRemoteServerResult<Output>

type RemoteMutationBrand = {
  __kiruRemoteMutation: true
  __kiruMutationId?: string
  __kiruInvoke: (args: RemoteMutationInvokeArgs) => Promise<HandlerWithScopeResult>
}

/** Prevent inference from flowing out of this position (schema drives `Input`). */
type NoInfer<T> = [T][T extends unknown ? 0 : never]

type RemoteMutationCall<Input, Output> = [Input] extends [void]
  ? (options?: RemoteCallOptions) => Promise<Output>
  : (input: Input, options?: RemoteCallOptions) => Promise<Output>

export type RemoteMutation<Input = void, Output = unknown> = RemoteMutationCall<
  Input,
  Output
> &
  RemoteMutationBrand

function rejectConfigObject(first: unknown): void {
  if (
    first &&
    typeof first === "object" &&
    "handler" in first
  ) {
    throw new Error(
      "mutation() no longer accepts config objects — use mutation(handler) or mutation(schema, handler)"
    )
  }
}

function assertNotRenderPhase(): void {
  if (
    __DEV__ &&
    typeof window === "undefined" &&
    renderMode.current === "string" &&
    !getRemoteExecutionContext() &&
    !getSsrRemoteScopeEntry()
  ) {
    throw new Error(
      "mutation() cannot be called during SSR render. Call from events, loaders, or inside another remote handler."
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
    throw new RemoteError("Invalid mutation input", "INVALID_INPUT", {
      status: 400,
    })
  }
}

function createRemoteMutation<Input, Output>(
  options: {
    handler:
      | RemoteMutationHandler<Input, Output>
      | RemoteMutationHandlerVoid<Output>
    inputSchema?: Schema<Input>
    isVoid: boolean
  }
): RemoteMutation<Input, Output> {
  const { handler, inputSchema, isVoid } = options

  const invoke = async (
    args: RemoteMutationInvokeArgs
  ): Promise<HandlerWithScopeResult> => {
    const { input: rawBody, requested } = parseMutationWireBody(args.body)
    beginRequestedScope(requested)
    beginQueryPatchCollector()
    try {
      const execution = args.execution ?? getRemoteExecutionContext()
      if (!execution) {
        throw new Error(
          "Remote mutation invoke requires RemoteExecution (HTTP entry or runInRemoteExecution)"
        )
      }
      const result = await runWithRemoteResponseScope(execution, async (scope) => {
        const input = await validateInput(
          inputSchema,
          isVoid ? null : rawBody
        )
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
            return (handler as RemoteMutationHandlerVoid<Output>)()
          }
          return (handler as RemoteMutationHandler<Input, Output>)(input)
        })
      })
      const patches = endQueryPatchCollector()
      if (patches.length) {
        return {
          handlerResult: attachQueryPatchesToPayload(result.handlerResult, patches),
          meta: result.meta,
        }
      }
      return result
    } catch (e) {
      endQueryPatchCollector()
      throw e
    } finally {
      endRequestedScope()
    }
  }

  const call = async (...args: unknown[]) => {
    assertNotRenderPhase()
    const { callArgs, options } = peelRemoteCallArgs(args)
    const input = (isVoid ? undefined : callArgs[0]) as Input
    const body = isVoid ? null : input

    const execution = getRemoteExecutionContext()
    const inProcess = resolveInProcessContext()
    const mutationId = mutationFn.__kiruMutationId ?? ""

    if (execution && inProcess) {
      return wrapInProcessMutationResult<Output>(
        async (wireBody) => {
          const { handlerResult } = await runWithRemoteFrame(mutationId, () =>
            mutationFn.__kiruInvoke({
              body: wireBody,
              query: {},
              context: inProcess.context,
              signal: options?.signal ?? inProcess.signal,
              request: execution.request.raw,
              execution,
            })
          )
          return handlerResult as Output
        },
        body
      )
    }

    return wrapMutationResult(
      Promise.resolve(undefined as Output),
      mutationId,
      body,
      options
    )
  }

  const mutationFn = Object.assign(call, {
    __kiruRemoteMutation: true as const,
    __kiruInvoke: invoke,
  }) as RemoteMutation<Input, Output>

  return mutationFn as RemoteMutation<Input, Output>
}

export function mutation<Output>(
  handler: RemoteMutationHandlerVoid<Output>
): RemoteMutation<void, Output>
export function mutation<S extends Schema<unknown>, Output>(
  schema: S,
  handler: NoInfer<
    (
      input: InferSchemaOutput<S>
    ) => Promise<KiruRemoteServerResult<Output>> | KiruRemoteServerResult<Output>
  >
): RemoteMutation<InferSchemaOutput<S>, Output>
export function mutation<Input, Output>(
  schema: Schema<Input>,
  handler: RemoteMutationHandler<Input, Output>
): RemoteMutation<Input, Output>
export function mutation(handlerOrSchema?: unknown, maybeHandler?: unknown) {
  // Overload shim: public overloads erase to a single runtime entry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mutationImpl(handlerOrSchema, maybeHandler) as any
}

function mutationImpl(
  handlerOrSchema?: unknown,
  maybeHandler?: unknown
): RemoteMutation<unknown, unknown> {
  if (typeof handlerOrSchema === "function") {
    return createRemoteMutation({
      handler: handlerOrSchema as RemoteMutationHandlerVoid<unknown>,
      isVoid: true,
    }) as RemoteMutation<unknown, unknown>
  }
  rejectConfigObject(handlerOrSchema)
  if (!maybeHandler) {
    throw new Error("mutation(schema, handler) requires a handler")
  }
  return createRemoteMutation({
    handler: maybeHandler as RemoteMutationHandler<unknown, unknown>,
    inputSchema: handlerOrSchema as Schema<unknown>,
    isVoid: false,
  }) as RemoteMutation<unknown, unknown>
}

/** Client codegen entry for positional mutation calls. */
export function __$mutation(
  mutationId: string,
  args: unknown[],
  isVoid = true
): Promise<unknown> {
  const stub = createRemoteMutation({
    handler: () => {
      throw new Error("Mutation handler missing on client bundle")
    },
    isVoid,
  }) as RemoteMutation<unknown, unknown>
  stub.__kiruMutationId = mutationId
  return (stub as (...a: unknown[]) => Promise<unknown>)(...args)
}
