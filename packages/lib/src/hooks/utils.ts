import { node } from "../globals.js"
import { sideEffectsEnabled } from "../utils/index.js"

export function queueSetupEffect(
  effect: Kiru.SetupEffect,
  opts?: { immediate?: boolean }
): void {
  if (!sideEffectsEnabled()) return
  const vNode = node.current!
  if (!vNode)
    throw new Error("Cannot queue setup effect outside of a component")
  if (opts?.immediate) {
    ;(vNode.immediateEffects ??= []).push(effect)
    return
  }
  ;(vNode.effects ??= []).push(effect)
}
