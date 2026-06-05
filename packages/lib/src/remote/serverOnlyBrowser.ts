import type { CustomRequestContext } from "../router/types.js"
import type { ResolvedRequestLimits } from "../router/requestLimits.js"
import type { CreateRemoteHandlerOptions } from "./remoteHttpHandler.js"
import type { BuildActionHttpResponseParams } from "./remoteHttpSerialize.js"
import type {
  CreateRemoteExecutionOptions,
  RemoteExecution,
  RemoteExecutionFrame,
} from "./remoteExecution.js"
import type { KiruSetCookie } from "./remoteRequestEvent.js"
import { assertServerOnly } from "./serverOnly.js"

const TOKEN_MSG = "Context tokens are signed and verified on the server only."
const SSR_MSG = "SSR request context is only available during server rendering."
const HTTP_MSG = "Remote HTTP response assembly runs on the server only."
const HANDLER_MSG = "createRemoteHandler() registers the server RPC entry point."
const EXEC_MSG = "Remote execution graph APIs run on the server only."

export function makeKiruContextToken(
  _ctx: CustomRequestContext,
  _secret: string,
  _limits?: ResolvedRequestLimits
): never {
  assertServerOnly("makeKiruContextToken", TOKEN_MSG)
}

export async function makeKiruContextTokenAsync(
  _ctx: Record<string, unknown>,
  _secret: string,
  _limits?: ResolvedRequestLimits
): Promise<never> {
  assertServerOnly("makeKiruContextTokenAsync", TOKEN_MSG)
}

export function unwrapKiruToken(
  _token: string,
  _secret: string,
  _limits?: ResolvedRequestLimits
): never {
  assertServerOnly("unwrapKiruToken", TOKEN_MSG)
}

export async function unwrapKiruTokenAsync(
  _token: string,
  _secret: string,
  _limits?: ResolvedRequestLimits
): Promise<never> {
  assertServerOnly("unwrapKiruTokenAsync", TOKEN_MSG)
}

export function runWithSsrRequestContext<T>(
  _ctx: CustomRequestContext,
  _signal: AbortSignal,
  _fn: () => T
): never {
  assertServerOnly("runWithSsrRequestContext", SSR_MSG)
}

export function __getSsrRemoteContext(): never {
  assertServerOnly("__getSsrRemoteContext", SSR_MSG)
}

export function __getSsrRequestContext(): never {
  assertServerOnly("__getSsrRequestContext", SSR_MSG)
}

export function normalizeRemoteResult(
  _handlerResult: unknown,
  _committed: unknown
): never {
  assertServerOnly("normalizeRemoteResult", HTTP_MSG)
}

export async function buildRemoteHttpResponse(
  _params: BuildActionHttpResponseParams
): Promise<never> {
  assertServerOnly("buildRemoteHttpResponse", HTTP_MSG)
}

export function serializeSetCookie(_cookie: KiruSetCookie): never {
  assertServerOnly("serializeSetCookie", HTTP_MSG)
}

export const KIRU_TOKEN_RESPONSE_HEADER = "x-kiru-context-token"

export function createRemoteHandler(
  _secret: string,
  _options?: CreateRemoteHandlerOptions
): never {
  assertServerOnly("createRemoteHandler", HANDLER_MSG)
}

export const __INTERNAL_REMOTE_REGISTRY = {
  register(_id: string, _fns: Record<string, unknown>): void {
    assertServerOnly("__INTERNAL_REMOTE_REGISTRY.register", HANDLER_MSG)
  },
}

export function createRemoteExecution(
  _options: CreateRemoteExecutionOptions
): never {
  assertServerOnly("createRemoteExecution", EXEC_MSG)
}

export function createRemoteFrame(
  _actionId: string,
  _parent?: RemoteExecutionFrame,
  _meta?: Record<string, unknown>
): never {
  assertServerOnly("createRemoteFrame", EXEC_MSG)
}

export function createCacheScope(): never {
  assertServerOnly("createCacheScope", EXEC_MSG)
}

export function createTraceContext(_traceId?: string): never {
  assertServerOnly("createTraceContext", EXEC_MSG)
}

export function listRemoteFrames(_execution: RemoteExecution): never {
  assertServerOnly("listRemoteFrames", EXEC_MSG)
}
