/**
 * Browser bundler entry for {@link ./index.js}: client RPC runtime and server-only stubs.
 * Token signing, handler registration, and remote definitions run on the server entry.
 */
export {
  redirect,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  formDataToInput,
  type KiruRedirect,
  type KiruSetCookie,
  type KiruActionResponseOptions,
  type ActionSchema,
  type Schema,
  type StandardJSONSchema,
  type StandardJSONSchemaV1,
  type StandardSchema,
  type StandardSchemaV1,
  type StandardSchemaWithJson,
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  parseInput,
  toInputJsonSchema,
  toOutputJsonSchema,
  type InferSchemaOutput,
  type RemoteFormClientOutput,
  type RemoteCookies,
  type RemoteCookieDefaults,
  type RemoteCookieSetOptions,
} from "./action.js"

export { getRequestEvent, type RemoteRequestEvent } from "./remoteRequestEvent.js"

export { query, mutation, form } from "./definitionFactories.client.js"

export {
  __$defineQuery,
  isRemoteQuery,
  type RemoteQuery,
  type RemoteQueryInstance,
  type RemoteQueryHandler,
} from "./query.js"

export {
  __$mutation,
  type RemoteMutation,
  type RemoteMutationHandler,
} from "./mutation.js"

export type {
  RemoteFormMutation,
  RemoteFormHandler,
  RemoteFormHandlerWithBody,
} from "./form.js"

export { requested } from "./requested.client.js"
export type {
  RequestedQueryEntry,
  RequestedQueryRefreshable,
} from "./requested.js"

export {
  RemoteDispatchError,
  isRemoteDispatchError,
  RemoteError,
  isRemoteError,
} from "./errors.js"

export {
  createFormController,
  type CreateFormControllerOptions,
  type CreateFormControllerResult,
} from "./formController.js"

export type { MutationResult, QueryUpdateTarget } from "./mutationResult.js"

export {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
  unwrapKiruTokenAsync,
} from "./serverOnlyBrowser.js"
export type { TokenHeader, TokenPayload } from "./token.js"

export {
  runWithSsrRequestContext,
  __getSsrRemoteContext,
  __getSsrRequestContext,
} from "./serverOnlyBrowser.js"

export {
  KIRU_TOKEN_RESPONSE_HEADER,
  normalizeRemoteResult,
  buildRemoteHttpResponse,
  serializeSetCookie,
} from "./serverOnlyBrowser.js"

export {
  createRemoteHandler,
  __INTERNAL_REMOTE_REGISTRY,
} from "./serverOnlyBrowser.js"
export type { CreateRemoteHandlerOptions } from "./remoteHttpHandler.js"

export {
  createRemoteExecution,
  createRemoteFrame,
  createCacheScope,
  createTraceContext,
  listRemoteFrames,
} from "./serverOnlyBrowser.js"
export type {
  RemoteExecution,
  RemoteExecutionFrame,
  RequestEnvelope,
  RuntimeContext,
  ExecutionState,
  MiddlewareState,
  CacheScope,
  TraceContext,
  TraceSpan,
  Transaction,
  CreateRemoteExecutionOptions,
} from "./remoteExecution.js"
