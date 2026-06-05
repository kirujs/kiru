import type { InferSchemaOutput, Schema } from "../validation/index.js"
import { parseInput } from "../validation/index.js"
import type { KiruRedirect, RemoteFormInvokeArgs } from "./action.js"
import { formDataToInput } from "./remoteRequestEvent.js"
import { getRemoteExecutionContext } from "./remoteInvokeScope.js"
import {
  runWithRemoteResponseScope,
  type HandlerWithScopeResult,
} from "./remoteResponseScope.js"
import { beginQueryPatchCollector, endQueryPatchCollector } from "./queryPatch.js"
import { parseRequestedFromFormData } from "./mutationWire.js"
import {
  beginRequestedScope,
  endRequestedScope,
} from "./requestedScope.js"
import { attachQueryPatchesToPayload } from "./remoteResponse.js"
import type { KiruRemoteServerResult } from "./remoteHandlerTypes.js"
import type { RemoteFormClientOutput } from "./action.js"
import {
  buildRemoteRequestEvent,
  runWithRemoteRequestEvent,
} from "./remoteRequestEvent.js"

export type RemoteFormMutation<Output = unknown> = {
  readonly __kiruFormMutation: true
  readonly __output?: Output
  __kiruFormMutationId: string
  __kiruInvoke: (
    args: RemoteFormInvokeArgs
  ) => Promise<HandlerWithScopeResult>
}

export type RemoteFormHandler<Output> = () =>
  | Promise<KiruRemoteServerResult<Output>>
  | KiruRemoteServerResult<Output>

export type RemoteFormHandlerWithBody<Input, Output> = (
  input: Input
) =>
  | Promise<KiruRemoteServerResult<Output>>
  | KiruRemoteServerResult<Output>

/** Prevent inference from flowing out of this position (schema drives `Input`). */
type NoInfer<T> = [T][T extends unknown ? 0 : never]

function rejectConfigObject(first: unknown): void {
  if (
    first &&
    typeof first === "object" &&
    "handler" in first
  ) {
    throw new Error(
      "form() no longer accepts config objects — use form(handler) or form(schema, handler)"
    )
  }
}

function createFormMutation<Input, Output>(options: {
  schema?: Schema<Input>
  handler:
    | RemoteFormHandler<Output>
    | RemoteFormHandlerWithBody<Input, Output>
}): RemoteFormMutation<Output> {
  const { schema: inputSchema, handler: runHandler } = options

  const __kiruInvoke = async (
    args: RemoteFormInvokeArgs
  ): Promise<HandlerWithScopeResult> => {
    beginRequestedScope(parseRequestedFromFormData(args.formData))
    beginQueryPatchCollector()
    try {
      const execution = getRemoteExecutionContext()
      if (!execution) {
        throw new Error(
          "Form mutation invoke requires RemoteExecution (HTTP entry or runInRemoteExecution)"
        )
      }
      const result = await runWithRemoteResponseScope(execution, async (scope) => {
        const scopedArgs = scope.toHandlerArgs(undefined as void, undefined as void)
        const event = buildRemoteRequestEvent({
          headers: scopedArgs.request.headers,
          formData: args.formData,
          context: scopedArgs.context,
          responseHeaders: scopedArgs.response.headers,
          cookies: scopedArgs.response.cookies,
          signal: scopedArgs.signal,
        })
        return runWithRemoteRequestEvent(event, async () => {
          if (inputSchema) {
            const raw = formDataToInput(args.formData)
            let body: Input
            try {
              body = await parseInput(inputSchema, raw)
            } catch {
              return {
                ok: false as const,
                errors: { _form: "Invalid input" },
              }
            }
            return (runHandler as RemoteFormHandlerWithBody<Input, Output>)(body)
          }
          return (runHandler as RemoteFormHandler<Output>)()
        })
      })
      const patches = endQueryPatchCollector()
      if (patches.length) {
        return attachQueryPatchesToPayload(result, patches) as HandlerWithScopeResult
      }
      return result
    } catch (e) {
      endQueryPatchCollector()
      throw e
    } finally {
      endRequestedScope()
    }
  }

  return {
    __kiruFormMutation: true,
    __kiruFormMutationId: "",
    __kiruInvoke,
  }
}

export function form<Output>(
  handler: RemoteFormHandler<Output>
): RemoteFormMutation<Output>
export function form<S extends Schema<unknown>, Output>(
  schema: S,
  handler: NoInfer<RemoteFormHandlerWithBody<InferSchemaOutput<S>, Output>>
): RemoteFormMutation<Output>
export function form<Input, Output>(
  schema: Schema<Input>,
  handler: RemoteFormHandlerWithBody<Input, Output>
): RemoteFormMutation<Output>
export function form(
  handlerOrSchema?: unknown,
  maybeHandler?: unknown
): RemoteFormMutation<unknown> {
  if (typeof handlerOrSchema === "function") {
    return createFormMutation({
      handler: handlerOrSchema as RemoteFormHandler<unknown>,
    })
  }
  rejectConfigObject(handlerOrSchema)
  if (!maybeHandler) {
    throw new Error("form(schema, handler) requires a handler")
  }
  return createFormMutation({
    schema: handlerOrSchema as Schema<unknown>,
    handler: maybeHandler as RemoteFormHandlerWithBody<unknown, unknown>,
  })
}

export type { RemoteFormClientOutput, KiruRedirect }
