import { __DEV__ } from "../env.js"
import { noop, sideEffectsEnabled } from "../utils/index.js"
import { useHook } from "./utils.js"

/**
 * Creates a stateful value, and returns the current value and a function to update it.
 *
 * @see https://kirujs.dev/docs/hooks/useState
 */
export function useState<T>(
  initial: T | (() => T)
): readonly [T, (value: Kiru.StateSetter<T>) => void] {
  if (!sideEffectsEnabled()) {
    return [
      typeof initial === "function" ? (initial as Function)() : initial,
      noop,
    ]
  }
  return useHook(
    "useState",
    {
      state: undefined as T,
      dispatch: noop as (value: Kiru.StateSetter<T>) => void,
    },
    ({ hook, isInit, update, isHMR }) => {
      if (__DEV__) {
        if (isInit) {
          hook.dev = {
            devtools: {
              get: () => ({ value: hook.state }),
              set: ({ value }) => (hook.state = value),
            } satisfies Kiru.HookDevtoolsProvisions<{ value: T }>,
            initialArgs: [initial],
          }
        }
        if (isHMR) {
          const [v] = hook.dev!.initialArgs
          if (v !== initial) {
            console.log("useState - initial args changed")
            isInit = true
            hook.dev!.initialArgs = [initial]
          }
        }
      }

      if (isInit) {
        hook.state =
          typeof initial === "function" ? (initial as Function)() : initial
        hook.dispatch = (setter: Kiru.StateSetter<T>) => {
          const newState =
            typeof setter === "function"
              ? (setter as Function)(hook.state)
              : setter
          if (Object.is(hook.state, newState)) return
          hook.state = newState
          update()
        }
      }

      return [hook.state, hook.dispatch] as const
    }
  )
}
