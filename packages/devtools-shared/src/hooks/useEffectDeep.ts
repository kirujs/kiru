import { useHook, cleanupHook, sideEffectsEnabled } from "kaioken"

export const deepEqual = (a: any, b: any) => {
  if (a === b) {
    return true
  }

  if (typeof a != "object" || typeof b != "object" || a == null || b == null) {
    return false
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length != bKeys.length) {
    return false
  }

  for (let key of aKeys) {
    if (!bKeys.includes(key) || !deepEqual(a[key], b[key])) {
      return false
    }
  }

  return true
}

const depsRequireChange = (a?: unknown[], b?: unknown[]) => {
  return !deepEqual(a, b)
}

export const useEffectDeep = (
  callback: () => void | (() => void),
  deps: unknown[]
) => {
  if (!sideEffectsEnabled()) return

  useHook(
    "useEffectDeep",
    { callback, deps },
    ({ hook, isInit, queueEffect }) => {
      if (isInit || depsRequireChange(deps, hook.deps)) {
        hook.deps = structuredClone(deps)
        cleanupHook(hook)
        queueEffect(() => {
          const cleanup = callback()
          if (cleanup && typeof cleanup === "function") {
            hook.cleanup = cleanup
          }
        })
      }
    }
  )
}
