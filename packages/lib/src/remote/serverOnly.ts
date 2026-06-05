import { __DEV__ } from "../env.js"
import { warnOnce } from "../router/devWarnings.dev.js"

export function assertServerOnly(api: string, detail?: string): never {
  const message =
    detail ??
    `${api}() is server-only and cannot run in the browser. Define and invoke remotes via SSR.`
  if (__DEV__) {
    warnOnce(`remote-server-only:${api}`, message)
  }
  throw new Error(message)
}
