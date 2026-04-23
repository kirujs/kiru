import { node } from "../globals.js"

export function getOwnerLifecycleHooks() {
  const current = node.current
  if (!current || typeof current.type !== "function") return null
  return (current.hooks ??= {
    pre: [],
    preCleanups: [],
    post: [],
    postCleanups: [],
  })
}

export function wrapLifecycleHookCallback(
  callback: Kiru.LifecycleHookCallback,
  cleanups: (() => void)[]
): Kiru.LifecycleHookCallback {
  return () => {
    const cleanup = callback()
    if (typeof cleanup === "function") {
      cleanups.push(cleanup)
    }
  }
}
