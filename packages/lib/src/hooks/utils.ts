import { $INLINE_FN } from "../constants.js"
import { node } from "../globals.js"

export function getVNodeLifecycleHooks(): null | NonNullable<
  Kiru.VNode["hooks"]
> {
  const vNode = node.current!
  if (!vNode || vNode.type === $INLINE_FN) return null

  return (vNode.hooks ??= {
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
