import { cleanupHook, useHook } from "kiru"
import { sideEffectsEnabled } from "kiru/utils"

type RefFnArg = {
  delta: number
  timestamp: DOMHighResTimeStamp
}

type RefFnOptions = {
  fpsLimit?: number
  immediate?: boolean
}

export const useRafFn = (
  callback: (arg: RefFnArg) => void,
  options?: RefFnOptions
) => {
  if (!sideEffectsEnabled())
    return {
      isActive: options?.immediate ?? false,
      start: () => null,
      stop: () => null,
    }

  const intervalLimit = options?.fpsLimit ? 1000 / options.fpsLimit : null
  return useHook(
    "useRafFn",
    () => ({
      callback,
      refId: null as number | null,
      previousFrameTimestamp: 0,
      isActive: options?.immediate ?? false,
      rafLoop: (() => {}) as FrameRequestCallback,
    }),
    ({ isInit, hook, update }) => {
      hook.callback = callback

      if (isInit) {
        hook.rafLoop = (timestamp) => {
          if (hook.isActive === false) return
          if (!hook.previousFrameTimestamp)
            hook.previousFrameTimestamp = timestamp

          const delta = timestamp - hook.previousFrameTimestamp
          if (intervalLimit && delta < intervalLimit) {
            hook.refId = window.requestAnimationFrame(hook.rafLoop)
            return
          }

          hook.previousFrameTimestamp = timestamp
          hook.callback({ delta, timestamp })
          hook.refId = window.requestAnimationFrame(hook.rafLoop)
        }
      }

      if (isInit && options?.immediate) {
        hook.isActive = true
        hook.refId = window.requestAnimationFrame(hook.rafLoop)
        hook.cleanup = () => {
          if (hook.refId != null) {
            window.cancelAnimationFrame(hook.refId)
          }
          hook.isActive = false
        }

        update()
      }

      return {
        isActive: hook.isActive,
        start: () => {
          if (hook.isActive === true) return

          hook.isActive = true
          hook.refId = window.requestAnimationFrame(hook.rafLoop)
          hook.cleanup = () => {
            if (hook.refId != null) {
              window.cancelAnimationFrame(hook.refId)
            }
            hook.isActive = false
          }
          update()
        },
        stop: () => {
          cleanupHook(hook)
          update()
        },
      }
    }
  )
}
