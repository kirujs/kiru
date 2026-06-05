import { KIRU_TOKEN_RESPONSE_HEADER } from "./remoteHeaders.js"

export function buildRemoteRpcHeaders(token: string): Record<string, string> {
  return {
    [KIRU_TOKEN_RESPONSE_HEADER]: token,
    "Content-Type": "application/json",
  }
}
