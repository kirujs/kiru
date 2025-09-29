import { node } from "../globals.js"
import { KiruError } from "../error.js"
import { noop, sideEffectsEnabled } from "../utils/index.js"
import { useHook } from "./utils.js"
import { __DEV__ } from "../env.js"

/**
 * Allows you to use a generic external store as long as it provides
 * a subscribe function and a way to get its current state.
 *
 * @see https://kirujs.dev/docs/hooks/useSyncExternalStore
 */
export function useSyncExternalStore<T>(
  subscribe: (callback: () => void) => () => void,
  getState: () => T,
  getServerState?: () => T
): T {
  if (!sideEffectsEnabled()) {
    if (getServerState === undefined) {
      throw new KiruError({
        message:
          "useSyncExternalStore must receive a getServerSnapshot function if the component is rendered on the server.",
        vNode: node.current!,
      })
    }
    return getServerState()
  }

  return useHook(
    "useSyncExternalStore",
    {
      state: null as T,
      unsubscribe: noop as () => void,
      subscribe,
    },
    ({ hook, isInit, update }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: { get: () => ({ value: hook.state }) },
        }
      }
      if (isInit || hook.subscribe !== subscribe) {
        hook.state = getState()
        hook.subscribe = subscribe
        hook.unsubscribe = subscribe(() => {
          const newState = getState()
          if (Object.is(hook.state, newState)) return
          hook.state = newState
          update()
        })
        hook.cleanup = () => {
          hook.unsubscribe()
          hook.unsubscribe = noop
        }
      }
      return hook.state
    }
  )
}
