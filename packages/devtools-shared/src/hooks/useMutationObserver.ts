import { cleanupHook, depsRequireChange, useHook } from "kiru"
import { sideEffectsEnabled } from "kiru/utils"

const isSupported =
  "window" in globalThis && "MutationObserver" in globalThis.window
export const useMutationObserver = (
  ref: Kiru.RefObject<Element | null>,
  callback: MutationCallback,
  options: MutationObserverInit | undefined = undefined
) => {
  if (!sideEffectsEnabled())
    return {
      isSupported,
      start: () => {},
      stop: () => {},
    }

  if (!isSupported) {
    return {
      isSupported,
      start: () => {},
      stop: () => {},
    }
  }

  // TODO: get rid of deps array
  return useHook(
    "useMutationObserver",
    {
      mutationObserver: null as MutationObserver | null,
      deps: [ref.current],
    },
    ({ isInit, hook, queueEffect }) => {
      if (isInit) {
        queueEffect(() => {
          hook.deps = [ref.current]
          hook.mutationObserver = new MutationObserver(callback)
          if (ref.current) {
            hook.mutationObserver.observe(ref.current, options)
          }
        })

        hook.cleanup = () => {
          hook.mutationObserver?.disconnect?.()
          hook.mutationObserver = null
        }
      } else if (depsRequireChange([ref.current], hook.deps)) {
        hook.deps = [ref.current]
        hook.mutationObserver?.disconnect?.()
        if (ref.current) {
          hook.mutationObserver?.observe(ref.current, options)
        }
      }

      return {
        isSupported,
        start: () => {
          if (hook.mutationObserver != null) {
            return
          }
          hook.mutationObserver = new MutationObserver(callback)
          if (ref.current) {
            hook.mutationObserver.observe(ref.current, options)
          }

          hook.cleanup = () => {
            hook.mutationObserver?.disconnect?.()
            hook.mutationObserver = null
          }
        },
        stop: () => {
          cleanupHook(hook)
        },
      }
    }
  )
}
