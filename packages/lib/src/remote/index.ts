import {
  createRemoteRegistry,
  createRemoteHandler as createRemoteHandlerImpl,
  type CreateRemoteHandlerOptions,
} from "./remoteHttpHandler.js"

export {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
  unwrapKiruToken,
  unwrapKiruTokenAsync,
} from "./token.js"
export type { TokenHeader, TokenPayload } from "./token.js"

export {
  redirect,
  isKiruRedirect,
  KIRU_FORM_TOKEN_FIELD,
  getRequestEvent,
  formDataToInput,
  type KiruSetCookie,
  type KiruActionResponseOptions,
  type KiruRedirect,
  type RemoteRequestEvent,
} from "./remoteRequestEvent.js"

export {
  type ActionSchema,
  type Schema,
  type StandardJSONSchema,
  type StandardJSONSchemaV1,
  type StandardSchema,
  type StandardSchemaV1,
  type StandardSchemaWithJson,
  parseInput,
  isStandardJSONSchemaV1,
  isStandardSchemaV1,
  toInputJsonSchema,
  toOutputJsonSchema,
  type RemoteInvokeArgs,
  type RemoteFormInvokeArgs,
  type ActionRequest,
  type ActionResponse,
  type RemoteCookies,
  type RemoteCookieDefaults,
  type RemoteCookieSetOptions,
  type RemoteFormClientOutput,
  runWithSsrRequestContext,
  __getSsrRemoteContext,
  __getSsrRequestContext,
} from "./action.js"

export {
  query,
  __$defineQuery,
  isRemoteQuery,
  type RemoteQuery,
  type RemoteQueryInstance,
  type RemoteQueryHandler,
  type InferQueryInput,
  type InferQueryOutput,
} from "./query.js"

export {
  mutation,
  __$mutation,
  type RemoteMutation,
  type RemoteMutationHandler,
} from "./mutation.js"

export {
  form,
  type RemoteFormMutation,
  type RemoteFormHandler,
  type RemoteFormHandlerWithBody,
} from "./form.js"

export { requested } from "./requested.js"
export type { MutationResult, QueryUpdateTarget } from "./mutationResult.js"
export { KIRU_REQUESTED_QUERIES_FIELD } from "./mutationWire.js"

export {
  remoteCallContext,
  runWithRemoteAbortSignal,
  runWithRemoteAbortSignalAsync,
  resolveRemoteFetchSignal,
} from "./abortScope.js"

export type { RemoteCallOptions } from "./remoteCallOptions.js"
export type { KiruRemoteServerResult } from "./remoteHandlerTypes.js"
export { isRemoteCallOptions, peelRemoteCallArgs } from "./remoteCallOptions.js"

export {
  seedQueryCache,
  applyQueryPatches,
  clearAllQueryCache,
  buildQueryCacheKey,
  type KiruQuerySnapshot,
} from "./queryCache.js"

export {
  noteQueryCacheKey,
  currentlyObservedQueries,
  captureSyncQueryObservations,
  createQueryCacheSubscriptionBinder,
  type QueryCacheSubscriptionBinder,
} from "./queryCacheTrack.js"

export {
  KIRU_QUERY_PATCHES_KEY,
  type KiruQueryPatch,
} from "./queryPatch.js"

export {
  KIRU_TOKEN_RESPONSE_HEADER,
  normalizeRemoteResult,
  buildRemoteHttpResponse,
  serializeSetCookie,
} from "./remoteHttpSerialize.js"

export {
  getRemoteExecutionContext,
  getActiveRemoteContext,
  runInRemoteExecution,
  runWithRemoteFrame,
  toRemoteHandlerArgs,
  createRemoteExecutionForRequest,
} from "./remoteInvokeScope.js"

export {
  createFormController,
  type CreateFormControllerOptions,
  type CreateFormControllerResult,
} from "./formController.js"

export {
  RemoteDispatchError,
  isRemoteDispatchError,
  RemoteError,
  isRemoteError,
} from "./errors.js"

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

export {
  createRemoteExecution,
  createRemoteFrame,
  createCacheScope,
  createTraceContext,
  headersToValidationInput,
  listRemoteFrames,
} from "./remoteExecution.js"

const remoteRegistry = createRemoteRegistry()

export const __INTERNAL_REMOTE_REGISTRY = {
  register(id: string, fns: Record<string, unknown>): void {
    remoteRegistry.register(id, fns)
  },
}

export function createRemoteHandler(
  secret: string,
  options?: CreateRemoteHandlerOptions
): (request: Request) => Promise<Response | null> {
  return createRemoteHandlerImpl(remoteRegistry, secret, options)
}
