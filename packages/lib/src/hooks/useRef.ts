import { __DEV__ } from "../env.js"
import { HookCallbackState, sideEffectsEnabled, useHook } from "./utils.js"

type UseCallbackState<T> = {
  ref: { current: T }
}

export function useRef<T>(initialValue: T): Kaioken.MutableRefObject<T>
export function useRef<T>(initialValue: T | null): Kaioken.RefObject<T>
export function useRef<T = undefined>(): Kaioken.MutableRefObject<T | undefined>
export function useRef<T>(initialValue?: T | null) {
  if (!sideEffectsEnabled()) return { current: initialValue }
  return useHook("useRef", { ref: { current: initialValue } }, useRefCallback)
}

/**
 * Creates a ref object. Useful for persisting values between renders or getting
 * a reference to an element.
 *
 * @see https://kaioken.dev/docs/hooks/useRef
 */
const useRefCallback = <T>({
  hook,
}: HookCallbackState<UseCallbackState<T>>) => {
  if (__DEV__) {
    hook.dev = {
      devtools: {
        get: () => ({ value: hook.ref.current }),
        set: ({ value }) => (hook.ref.current = value),
      } satisfies Kaioken.HookDevtoolsProvisions<{ value: T }>,
    }
  }
  return hook.ref
}
