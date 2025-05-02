import { __DEV__ } from "../env.js"
import { noop } from "../utils.js"
import { sideEffectsEnabled, useHook } from "./utils.js"

/**
 * Creates a stateful value, and returns the current value and a function to update it.
 *
 * @see https://kaioken.dev/docs/hooks/useState
 */
export function useState<T>(
  initial: T | (() => T)
): readonly [T, (value: Kaioken.StateSetter<T>) => void] {
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
      dispatch: noop as (value: Kaioken.StateSetter<T>) => void,
    },
    ({ hook, isInit, update }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: {
            get: () => ({ value: hook.state }),
            set: ({ value }) => (hook.state = value),
          } satisfies Kaioken.HookDevtoolsProvisions<{ value: T }>,
        }
      }
      if (isInit) {
        hook.state =
          typeof initial === "function" ? (initial as Function)() : initial
        hook.dispatch = (setter: Kaioken.StateSetter<T>) => {
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
