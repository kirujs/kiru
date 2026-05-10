import type { CustomRequestContext } from "../router/types.js"
import { RemoteError } from "./errors.js"

export { RemoteError, isRemoteError } from "./errors.js"

type RequestContext = Record<string, unknown>

export type RemoteActionCallback<Input, Output> = (
  ctx: CustomRequestContext,
  input: Input
) => Promise<Output> | Output

export type RemoteActionSchema<Input> = {
  parse: (input: unknown) => input is Input
}

export type RemoteActionFunction<Input, Output> = ((
  input?: Input
) => Promise<Output>) & {
  __kiruRemoteAction: true
  __kiruInvoke: (ctx: RequestContext, input: unknown) => Promise<Output>
}

export function action<Input, Output>(
  callback: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output>
export function action<Input, Output>(
  schema: RemoteActionSchema<Input>,
  callback: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output>
export function action<Input, Output>(
  callbackOrSchema: RemoteActionSchema<Input> | RemoteActionCallback<Input, Output>,
  callback?: RemoteActionCallback<Input, Output>
): RemoteActionFunction<Input, Output> {
  const hasSchema = typeof callback === "function"
  const schema = hasSchema
    ? (callbackOrSchema as RemoteActionSchema<Input>)
    : undefined
  const run = hasSchema
    ? callback
    : (callbackOrSchema as RemoteActionCallback<Input, Output>)
  const wrapped = (async (_input?: Input): Promise<Output> => {
    throw new Error(
      "[kiru/remote]: Remote actions are only invokable through the router runtime."
    )
  }) as RemoteActionFunction<Input, Output>

  wrapped.__kiruRemoteAction = true
  wrapped.__kiruInvoke = async (ctx, input) => {
    if (schema && !schema.parse(input)) {
      throw new RemoteError("Invalid remote action input", "INVALID_INPUT", {
        status: 400,
      })
    }
    return await run(ctx as CustomRequestContext, input as Input)
  }

  return wrapped
}
