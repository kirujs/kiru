/**
 * Browser bundler entry for {@link ./index.js}: remote helpers only.
 * Token signing and RPC handlers live in the server entry (Node crypto).
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

export {
  query,
  __$defineQuery,
  isRemoteQuery,
  type RemoteQuery,
  type RemoteQueryInstance,
  type RemoteQueryHandler,
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
