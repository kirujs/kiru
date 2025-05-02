import {
  cleanupHook,
  depsRequireChange,
  sideEffectsEnabled,
  useHook,
} from "kaioken"

const isSupported =
  "window" in globalThis && "ResizeObserver" in globalThis.window

export const useResizeObserver = (
  ref: Kaioken.MutableRefObject<Element | null>,
  callback: ResizeObserverCallback,
  options: ResizeObserverOptions | undefined = undefined
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

  // TODO: get rid of the deps array
  return useHook(
    "useResizeObserver",
    {
      resizeObserver: null as ResizeObserver | null,
      deps: [ref.current],
    },
    ({ isInit, hook, queueEffect }) => {
      if (isInit) {
        hook.resizeObserver = new ResizeObserver(callback)
        hook.cleanup = () => {
          hook.resizeObserver?.disconnect?.()
          hook.resizeObserver = null
        }
      }

      queueEffect(() => {
        if (depsRequireChange([ref.current], hook.deps)) {
          hook.deps = [ref.current]
          hook.resizeObserver?.disconnect?.()
          if (ref.current) {
            hook.resizeObserver?.observe(ref.current, options)
          }
        }
      })

      return {
        isSupported,
        start: () => {
          if (hook.resizeObserver != null) {
            return
          }
          hook.resizeObserver = new ResizeObserver(callback)
          if (ref.current) {
            hook.resizeObserver.observe(ref.current, options)
          }

          hook.cleanup = () => {
            hook.resizeObserver?.disconnect?.()
            hook.resizeObserver = null
          }
        },
        stop: () => {
          cleanupHook(hook)
        },
      }
    }
  )
}
