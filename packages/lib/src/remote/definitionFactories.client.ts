import type { InferSchemaOutput, Schema } from "../validation/index.js"
import type {
  RemoteFormHandler,
  RemoteFormHandlerWithBody,
  RemoteFormMutation,
} from "./form.js"
import type {
  RemoteMutation,
  RemoteMutationHandler,
} from "./mutation.js"
import type {
  RemoteQuery,
  RemoteQueryHandler,
  RemoteQueryHandlerVoid,
} from "./query.js"
import { assertServerOnly } from "./serverOnly.js"

const DEFINE_MSG =
  "Define remotes in `.remote.ts` on the server; client bundles use vite-plugin-kiru codegen stubs."

type NoInfer<T> = [T][T extends unknown ? 0 : never]

export function query<Output>(
  _handler: RemoteQueryHandlerVoid<Output>
): RemoteQuery<void, Output>
export function query<S extends Schema<unknown>, Output>(
  _schema: S,
  _handler: NoInfer<
    (input: InferSchemaOutput<S>) => Promise<Output> | Output
  >
): RemoteQuery<InferSchemaOutput<S>, Output>
export function query<Input, Output>(
  _schema: Schema<Input>,
  _handler: RemoteQueryHandler<Input, Output>
): RemoteQuery<Input, Output>
export function query(_handlerOrSchema?: unknown, _maybeHandler?: unknown): never {
  assertServerOnly("query", DEFINE_MSG)
}

export function mutation<Output>(
  _handler: () =>
    | Promise<unknown>
    | unknown
): RemoteMutation<void, Output>
export function mutation<S extends Schema<unknown>, Output>(
  _schema: S,
  _handler: NoInfer<
    (
      input: InferSchemaOutput<S>
    ) => Promise<unknown> | unknown
  >
): RemoteMutation<InferSchemaOutput<S>, Output>
export function mutation<Input, Output>(
  _schema: Schema<Input>,
  _handler: RemoteMutationHandler<Input, Output>
): RemoteMutation<Input, Output>
export function mutation(
  _handlerOrSchema?: unknown,
  _maybeHandler?: unknown
): never {
  assertServerOnly("mutation", DEFINE_MSG)
}

export function form<Output>(
  _handler: RemoteFormHandler<Output>
): RemoteFormMutation<Output>
export function form<S extends Schema<unknown>, Output>(
  _schema: S,
  _handler: NoInfer<RemoteFormHandlerWithBody<InferSchemaOutput<S>, Output>>
): RemoteFormMutation<Output>
export function form(_handlerOrSchema?: unknown, _maybeHandler?: unknown): never {
  assertServerOnly("form", DEFINE_MSG)
}
