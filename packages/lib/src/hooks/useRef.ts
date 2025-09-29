import { __DEV__ } from "../env.js"
import { sideEffectsEnabled } from "../utils/index.js"
import { useHook } from "./utils.js"

/**
 * Creates a ref object. Useful for persisting values between renders or getting
 * a reference to an element.
 *
 * @see https://kirujs.dev/docs/hooks/useRef
 */
export function useRef<T>(initialValue: T): Kiru.MutableRefObject<T>
export function useRef<T>(initialValue: T | null): Kiru.RefObject<T>
export function useRef<T = undefined>(): Kiru.MutableRefObject<T | undefined>
export function useRef<T>(initialValue?: T | null) {
  if (!sideEffectsEnabled()) return { current: initialValue }
  return useHook(
    "useRef",
    { ref: { current: initialValue } },
    ({ hook, isInit, isHMR }) => {
      if (__DEV__) {
        if (isInit) {
          hook.dev = {
            devtools: {
              get: () => ({ value: hook.ref.current! }),
              set: ({ value }) => (hook.ref.current = value),
            } satisfies Kiru.HookDevtoolsProvisions<{ value: T }>,
            initialArgs: [hook.ref.current],
          }
        }
        if (isHMR) {
          const [v] = hook.dev!.initialArgs
          if (v !== initialValue) {
            hook.ref = { current: initialValue }
            hook.dev!.initialArgs = [initialValue]
          }
        }
      }
      return hook.ref
    }
  )
}
