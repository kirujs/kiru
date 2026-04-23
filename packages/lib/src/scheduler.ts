import type { AppHandle } from "./appHandle.js"
import { ROOT_OWNER_TYPE } from "./dom/metadata.js"
import { updateFunctionOwner } from "./dom/runtime.js"
import { captureFocus, reinstateFocus } from "./dom/focus.js"
import { node, postEffectCleanups } from "./globals.js"

let app: AppHandle | null = null
let queuedOwners: Kiru.KiruNode[] = []
let isRunningOrQueued = false
let nextIdleEffects: Array<() => void> = []
let animationFrameHandle = -1
let preEffects: Kiru.LifecycleHookCallback[] = []
let postEffects: Kiru.LifecycleHookCallback[] = []

/**
 * Runs a function after any existing work has been completed,
 * or immediately if the scheduler is already idle.
 */
export function nextIdle(fn: () => void): void {
  if (isRunningOrQueued) {
    nextIdleEffects.push(fn)
    return
  }
  fn()
}

/**
 * Syncronously flushes any pending work.
 */
export function flushSync(): void {
  if (!isRunningOrQueued) return
  window.cancelAnimationFrame(animationFrameHandle)
  doWork()
}

export function renderRootSync(rootNode: Kiru.KiruNode): void {
  rootNode.dirty = true
  queuedOwners.push(rootNode)
  isRunningOrQueued = true
  flushSync()
}

/**
 * Queues a node for an update. Has no effect if the node is already deleted or marked for deletion.
 */
export function requestUpdate(owner: Kiru.KiruNode): void {
  queueUpdate(owner)
}

export function useRequestUpdate(): () => void {
  const n = node.current
  if (!n) {
    throw new Error("useRequestUpdate must be called inside a Kiru component")
  }
  return () => requestUpdate(n)
}

function queueUpdate(owner: Kiru.KiruNode): void {
  if (owner.dirty || owner.unmounted) return
  owner.dirty = true
  queuedOwners.push(owner)
  if (!isRunningOrQueued) {
    isRunningOrQueued = true
    animationFrameHandle = window.requestAnimationFrame(doWork)
  }
}

function doWork(): void {
  app = queuedOwners[0]?.app ?? null
  captureFocus()
  while (queuedOwners.length) {
    const queued = queuedOwners.shift()!
    if (!queued.dirty || queued.unmounted) continue
    if (queued.type === ROOT_OWNER_TYPE) {
      queued.render?.(queued.props)
      queued.dirty = false
    } else {
      updateFunctionOwner(queued)
    }
    const hooks = queued.hooks
    if (hooks) {
      preEffects.push(...hooks.pre)
      postEffects.push(...hooks.post)
      hooks.pre.length = 0
      hooks.post.length = 0
    }
  }
  reinstateFocus()
  flushEffects(preEffects)
  isRunningOrQueued = false
  while (nextIdleEffects.length) {
    nextIdleEffects.shift()!()
  }
  queueMicrotask(() => {
    flushEffects(postEffectCleanups)
    flushEffects(postEffects)
  })
  if (app && "window" in globalThis) {
    window.__kiru.emit("update", app!)
  }
}

function flushEffects(effectArr: Function[]): void {
  for (let i = 0; i < effectArr.length; i++) {
    effectArr[i]()
  }
  effectArr.length = 0
}
