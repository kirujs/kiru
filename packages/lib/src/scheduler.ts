import type {
  ContextProviderNode,
  DomVNode,
  ErrorBoundaryNode,
  FunctionVNode,
} from "./types.utils"
import {
  $CONTEXT_PROVIDER,
  $ERROR_BOUNDARY,
  CONSECUTIVE_DIRTY_LIMIT,
  FLAG_DELETION,
  FLAG_DIRTY,
} from "./constants.js"
import {
  commitDeletion,
  commitWork,
  createDom,
  hydrateDom,
  onAfterFlushDomChanges,
  onBeforeFlushDomChanges,
} from "./dom.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"
import { hookIndex, node, renderMode } from "./globals.js"
import { hydrationStack } from "./hydration.js"
import { reconcileChildren } from "./reconciler.js"
import {
  assertValidElementProps,
  latest,
  traverseApply,
  isExoticType,
  getVNodeAppContext,
  findParentErrorBoundary,
  call,
  propsChanged,
} from "./utils/index.js"
import type { AppContext } from "./appContext"
import { isHmrUpdate } from "./hmr.js"

type VNode = Kiru.VNode

let appCtx: AppContext | null
let treesInProgress: VNode[] = []
let isRunningOrQueued = false
let nextIdleEffects: (() => void)[] = []
let deletions: VNode[] = []
let isImmediateEffectsMode = false
let immediateEffectDirtiedRender = false
let isRenderDirtied = false
let consecutiveDirtyCount = 0
let preEffects: Kiru.LifecycleHookCallback[] = []
let postEffects: Kiru.LifecycleHookCallback[] = []
let animationFrameHandle = -1

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

export function renderRootSync(rootNode: VNode): void {
  rootNode.flags |= FLAG_DIRTY
  treesInProgress.push(rootNode)

  isRunningOrQueued = true
  flushSync()
}

/**
 * Queues a node for an update. Has no effect if the node is already deleted or marked for deletion.
 */
export function requestUpdate(vNode: VNode): void {
  if (renderMode.current === "hydrate") {
    return nextIdle(() => queueUpdate(vNode))
  }
  queueUpdate(vNode)
}

function queueBeginWork(): void {
  if (isRunningOrQueued) return
  isRunningOrQueued = true
  animationFrameHandle = window.requestAnimationFrame(doWork)
}

function onWorkFinished(): void {
  isRunningOrQueued = false
  while (nextIdleEffects.length) {
    nextIdleEffects.shift()!()
  }
}

function queueUpdate(vNode: VNode): void {
  // In immediate effect mode (useLayoutEffect), immediately mark the render as dirty
  if (isImmediateEffectsMode) {
    immediateEffectDirtiedRender = true
  }

  // If this node is currently being rendered, just mark it dirty
  if (node.current === vNode) {
    if (__DEV__) {
      window.__kiru.profilingContext?.emit("updateDirtied", appCtx!)
    }
    isRenderDirtied = true
    return
  }

  if (vNode.flags & (FLAG_DIRTY | FLAG_DELETION)) return
  vNode.flags |= FLAG_DIRTY

  if (!treesInProgress.length) {
    treesInProgress.push(vNode)
    return queueBeginWork()
  }

  treesInProgress.push(vNode)
}

function queueDelete(vNode: VNode): void {
  traverseApply(vNode, (n) => (n.flags |= FLAG_DELETION))
  deletions.push(vNode)
}

const depthSort = (a: VNode, b: VNode): number => b.depth - a.depth

let currentWorkRoot: VNode | null = null

function doWork(): void {
  if (__DEV__) {
    const n = deletions[0] ?? treesInProgress[0]
    if (n) {
      appCtx = getVNodeAppContext(n)!
      window.__kiru.profilingContext?.beginTick(appCtx)
    } else {
      appCtx = null
    }
  }

  let len = 1

  onBeforeFlushDomChanges()
  while (treesInProgress.length) {
    if (treesInProgress.length > len) {
      treesInProgress.sort(depthSort)
    }

    currentWorkRoot = treesInProgress.shift()!
    len = treesInProgress.length

    const flags = currentWorkRoot.flags
    if (flags & FLAG_DELETION) continue
    if (flags & FLAG_DIRTY) {
      let n: VNode | null = currentWorkRoot
      while ((n = performUnitOfWork(n))) {}

      while (deletions.length) {
        commitDeletion(deletions.pop()!)
      }

      commitWork(currentWorkRoot)
      currentWorkRoot.flags &= ~FLAG_DIRTY
    }
  }
  onAfterFlushDomChanges()

  isImmediateEffectsMode = true
  flushEffects(preEffects)
  isImmediateEffectsMode = false

  if (immediateEffectDirtiedRender) {
    checkForTooManyConsecutiveDirtyRenders()
    flushEffects(postEffects)
    immediateEffectDirtiedRender = false
    consecutiveDirtyCount++
    if (__DEV__) {
      window.__kiru.profilingContext?.endTick(appCtx!)
      window.__kiru.profilingContext?.emit("updateDirtied", appCtx!)
    }
    return flushSync()
  }
  consecutiveDirtyCount = 0

  onWorkFinished()
  queueMicrotask(() => flushEffects(postEffects))
  if (__DEV__) {
    window.__kiru.emit("update", appCtx!)
    window.__kiru.profilingContext?.emit("update", appCtx!)
    window.__kiru.profilingContext?.endTick(appCtx!)
  }
}

function performUnitOfWork(vNode: VNode): VNode | null {
  const next = updateVNode(vNode)

  if (vNode.deletions !== null) {
    vNode.deletions.forEach(queueDelete)
    vNode.deletions = null
  }

  if (next) {
    return next
  }

  let nextNode: VNode | null = vNode
  while (nextNode) {
    // queue effects upon ascent
    const { hooks } = nextNode
    if (hooks) {
      preEffects.push(...hooks.pre)
      postEffects.push(...hooks.post)
      hooks.pre.length = 0
      hooks.post.length = 0
    }

    if (nextNode === currentWorkRoot) return null
    if (nextNode.sibling) {
      return nextNode.sibling
    }

    nextNode = nextNode.parent
    if (renderMode.current === "hydrate" && nextNode?.dom) {
      hydrationStack.pop()
    }
  }

  return null
}

function updateVNode(vNode: VNode): VNode | null {
  const { type, props, prev, flags } = vNode

  if (__DEV__ && isHmrUpdate()) {
  } else if (
    prev &&
    (flags & FLAG_DIRTY) === 0 &&
    (prev.props === props || !propsChanged(prev.props, props))
  ) {
    return null
  }
  try {
    if (typeof type === "string") {
      return updateHostComponent(vNode as DomVNode)
    } else if (isExoticType(type)) {
      return updateExoticComponent(vNode)
    } else {
      return updateFunctionComponent(vNode as FunctionVNode)
    }
  } catch (error) {
    if (__DEV__) {
      window.__kiru.emit(
        "error",
        appCtx!,
        error instanceof Error ? error : new Error(String(error))
      )
    }

    const handler = findParentErrorBoundary(vNode)
    if (handler) {
      const e = (handler.error =
        error instanceof Error ? error : new Error(String(error)))

      handler.props.onError?.(e)
      if (handler.depth < currentWorkRoot!.depth) {
        currentWorkRoot = handler
      }
      return handler
    }

    if (KiruError.isKiruError(error)) {
      if (error.customNodeStack) {
        setTimeout(() => {
          throw new Error(error.customNodeStack)
        })
      }
      if (error.fatal) {
        throw error
      }
      console.error(error)
      return vNode.child
    }
    setTimeout(() => {
      throw error
    })
  }
  return null
}

function updateExoticComponent(vNode: VNode): VNode | null {
  const { props, type } = vNode
  let children = props.children

  if (type === $CONTEXT_PROVIDER) {
    const {
      props: { dependents, value },
      prev,
    } = vNode as ContextProviderNode<unknown>

    if (dependents.size && prev && prev.props.value !== value) {
      dependents.forEach(queueUpdate)
    }
  } else if (type === $ERROR_BOUNDARY) {
    const n = vNode as ErrorBoundaryNode
    const { error } = n
    if (error) {
      children =
        typeof props.fallback === "function"
          ? props.fallback(error)
          : props.fallback

      delete n.error
    }
  }

  return (vNode.child = reconcileChildren(vNode, children))
}

function updateFunctionComponent(vNode: FunctionVNode): VNode | null {
  const { type, props, subs } = vNode

  try {
    node.current = vNode
    let newChild
    let renderTryCount = 0
    do {
      vNode.flags &= ~FLAG_DIRTY
      isRenderDirtied = false
      hookIndex.current = 0

      /**
       * remove previous signal subscriptions (if any) every render.
       * this prevents no-longer-observed signals from triggering updates
       * in components that are not currently using them.
       *
       * TODO: in future, we might be able to optimize this by
       * only clearing the subscriptions that are no longer needed
       * and not clearing the entire set.
       */
      if (subs) {
        subs.forEach(call)
        subs.clear()
      }

      if (__DEV__) {
        if (isHmrUpdate()) {
          const { hooks } = vNode
          if (vNode.cleanups) {
            Object.values(vNode.cleanups).forEach((c) => c())
            delete vNode.cleanups
          }
          if (hooks) {
            const { preCleanups, postCleanups } = hooks
            preCleanups.forEach((c) => c())
            postCleanups.forEach((c) => c())
            preCleanups.length = postCleanups.length = 0
          }
          delete vNode.render
        }

        if (vNode.render) {
          newChild = vNode.render(props)
        } else {
          newChild = latest(type)(props)
          if (typeof newChild === "function") {
            vNode.render = newChild as (props: any) => unknown
            newChild = vNode.render(props)
          }
        }

        if (++renderTryCount > CONSECUTIVE_DIRTY_LIMIT) {
          throw new KiruError({
            message:
              "Too many re-renders. Kiru limits the number of renders to prevent an infinite loop.",
            fatal: true,
            vNode,
          })
        }
        continue
      }

      if (vNode.render) {
        newChild = vNode.render(props)
      } else {
        newChild = type(props)
        if (typeof newChild === "function") {
          vNode.render = newChild as (props: any) => unknown
          newChild = vNode.render(props)
        }
      }
    } while (isRenderDirtied)

    return (vNode.child = reconcileChildren(vNode, newChild))
  } finally {
    node.current = null
  }
}

function updateHostComponent(vNode: DomVNode): VNode | null {
  const { props, type } = vNode
  if (__DEV__) {
    assertValidElementProps(vNode)
  }
  if (!vNode.dom) {
    if (renderMode.current === "hydrate") {
      hydrateDom(vNode)
    } else {
      vNode.dom = createDom(vNode)
    }
    if (__DEV__ && vNode.dom instanceof Element) {
      vNode.dom.__kiruNode = vNode
    }
  }
  // text should _never_ have children
  if (type !== "#text") {
    vNode.child = reconcileChildren(vNode, props.children)
    if (vNode.child && renderMode.current === "hydrate") {
      hydrationStack.push(vNode.dom!)
    }
  }

  return vNode.child
}

function checkForTooManyConsecutiveDirtyRenders(): void {
  if (consecutiveDirtyCount > CONSECUTIVE_DIRTY_LIMIT) {
    throw new KiruError(
      "Maximum update depth exceeded. This can happen when a component repeatedly calls setState during render or in useLayoutEffect. Kiru limits the number of nested updates to prevent infinite loops."
    )
  }
}

function flushEffects(effectArr: Function[]): void {
  for (let i = 0; i < effectArr.length; i++) {
    effectArr[i]()
  }
  effectArr.length = 0
}
