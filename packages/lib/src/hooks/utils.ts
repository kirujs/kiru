import { node } from "../globals.js"
import { sideEffectsEnabled } from "../utils/index.js"

export function queueSetupEffect(
  effect: Kiru.LifecycleHookCallback,
  opts?: { immediate?: boolean }
): void {
  if (!sideEffectsEnabled()) return
  const vNode = node.current!
  if (!vNode)
    throw new Error("Cannot queue setup effect outside of a component")

  const hooks = (vNode.hooks ??= {
    pre: [],
    preCleanups: [],
    post: [],
    postCleanups: [],
  })

  const [bag, cleanups] = opts?.immediate
    ? [hooks.pre, hooks.preCleanups]
    : [hooks.post, hooks.postCleanups]

  const wrapped = () => {
    const ret = effect()
    if (typeof ret === "function") {
      cleanups.push(ret)
    }
  }

  bag.push(wrapped)
}
