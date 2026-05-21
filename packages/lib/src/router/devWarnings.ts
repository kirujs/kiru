import { __DEV__ } from "../env.js"
import {
  isPureClientBootstrap,
  isSsrBootstrap,
} from "./bootstrapEnv.js"
import { getRouterBootstrapMode } from "./bootstrapMode.js"
import * as dev from "./devWarnings.dev.js"

export type { RouterBootstrapMode } from "./bootstrapMode.js"
export { markRouterBootstrap, getRouterBootstrapMode } from "./bootstrapMode.js"

function hasLoaderRpcClient(): boolean {
  return !!(globalThis as Record<string, unknown>).__kiru_loaders
}

const SERVER_LOADER_PURE_CLIENT_ERR =
  "[kiru] serverLoader is not supported in this client bootstrap (use kiru/router/ssr)."

const REMOTE_ACTION_PURE_CLIENT_ERR =
  "[kiru] Remote action requires SSR (createRenderer + actions.secret)."

/** @throws when `serverLoader` cannot run on this client bootstrap. */
export function guardServerLoaderOnClient(): void {
  if (typeof window === "undefined" && typeof document === "undefined") {
    return
  }
  if (isPureClientBootstrap(getRouterBootstrapMode)) {
    if (__DEV__) {
      dev.warnOnce(
        "server-loader-pure-client",
        dev.SERVER_LOADER_PURE_CLIENT_DEV_MSG
      )
    }
    throw new Error(SERVER_LOADER_PURE_CLIENT_ERR)
  }
  if (isSsrBootstrap(getRouterBootstrapMode) && !hasLoaderRpcClient()) {
    if (__DEV__) {
      dev.warnOnce("server-loader-without-rpc", dev.SERVER_LOADER_NO_RPC_DEV_MSG)
    }
  }
}

/** @throws when remote actions cannot run on this client bootstrap. */
export function guardRemoteActionOnClient(): void {
  if (typeof window === "undefined") return
  if (isPureClientBootstrap(getRouterBootstrapMode)) {
    if (__DEV__) {
      dev.warnOnce(
        "remote-action-pure-client",
        dev.REMOTE_ACTION_PURE_CLIENT_DEV_MSG
      )
    }
    throw new Error(REMOTE_ACTION_PURE_CLIENT_ERR)
  }
}
