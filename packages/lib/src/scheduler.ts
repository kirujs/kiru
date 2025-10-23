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
  FLAG_MEMO,
  FLAG_NOOP,
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
import { assertValidElementProps } from "./utils/index.js"
import { reconcileChildren } from "./reconciler.js"
import {
  latest,
  traverseApply,
  isExoticType,
  getVNodeAppContext,
  findParentErrorBoundary,
} from "./utils/index.js"
import type { AppContext } from "./appContext"

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
let preEffects: Array<Function> = []
let postEffects: Array<Function> = []
let animationFrameHandle = -1

/**
 * Runs a function after any existing work has been completed,
 * or immediately if the scheduler is already idle.
 */
export function nextIdle(fn: () => void) {
  if (isRunningOrQueued) {
    nextIdleEffects.push(fn)
    return
  }
  fn()
}

/**
 * Syncronously flushes any pending work.
 */
export function flushSync() {
  if (!isRunningOrQueued) return
  window.cancelAnimationFrame(animationFrameHandle)
  doWork()
}

export function renderRootSync(rootNode: VNode) {
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

function queueBeginWork() {
  if (isRunningOrQueued) return
  isRunningOrQueued = true
  animationFrameHandle = window.requestAnimationFrame(doWork)
}

function onWorkFinished() {
  isRunningOrQueued = false
  while (nextIdleEffects.length) {
    nextIdleEffects.shift()!()
  }
}

function queueUpdate(vNode: VNode) {
  // In immediate effect mode (useLayoutEffect), immediately mark the render as dirty
  if (isImmediateEffectsMode) {
    immediateEffectDirtiedRender = true
  }

  // If this node is currently being rendered, just mark it dirty
  if (node.current === vNode) {
    if (__DEV__) {
      window.__kiru?.profilingContext?.emit("updateDirtied", appCtx!)
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

function queueDelete(vNode: VNode) {
  traverseApply(vNode, (n) => (n.flags |= FLAG_DELETION))
  deletions.push(vNode)
}

const depthSort = (a: VNode, b: VNode) => b.depth - a.depth

let currentWorkRoot: VNode | null = null

function doWork(): void {
  if (__DEV__) {
    const n = deletions[0] ?? treesInProgress[0]
    if (n) {
      appCtx = getVNodeAppContext(n)!
      window.__kiru?.profilingContext?.beginTick(appCtx)
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
      let n: VNode | void = currentWorkRoot
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
      window.__kiru?.profilingContext?.endTick(appCtx!)
      window.__kiru?.profilingContext?.emit("updateDirtied", appCtx!)
    }
    return flushSync()
  }
  consecutiveDirtyCount = 0

  onWorkFinished()
  flushEffects(postEffects)
  if (__DEV__) {
    window.__kiru!.emit("update", appCtx!)
    window.__kiru?.profilingContext?.emit("update", appCtx!)
    window.__kiru?.profilingContext?.endTick(appCtx!)
  }
}

function performUnitOfWork(vNode: VNode): VNode | void {
  let renderChild = true
  try {
    if (typeof vNode.type === "string") {
      updateHostComponent(vNode as DomVNode)
    } else if (isExoticType(vNode.type)) {
      updateExoticComponent(vNode)
    } else {
      renderChild = updateFunctionComponent(vNode as FunctionVNode)
    }
  } catch (error) {
    if (__DEV__) {
      window.__kiru?.emit(
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
      return
    }
    setTimeout(() => {
      throw error
    })
  }

  if (vNode.deletions !== null) {
    vNode.deletions.forEach(queueDelete)
    vNode.deletions = null
  }

  if (renderChild && vNode.child) {
    return vNode.child
  }

  let nextNode: VNode | null = vNode
  while (nextNode) {
    // queue effects upon ascent
    if (nextNode.immediateEffects) {
      preEffects.push(...nextNode.immediateEffects)
      nextNode.immediateEffects = undefined
    }
    if (nextNode.effects) {
      postEffects.push(...nextNode.effects)
      nextNode.effects = undefined
    }

    if (nextNode === currentWorkRoot) return
    if (nextNode.sibling) {
      return nextNode.sibling
    }

    nextNode = nextNode.parent
    if (renderMode.current === "hydrate" && nextNode?.dom) {
      hydrationStack.pop()
    }
  }
}

function updateExoticComponent(vNode: VNode) {
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

  vNode.child = reconcileChildren(vNode, children)
}

function updateFunctionComponent(vNode: FunctionVNode) {
  const { type, props, subs, prev, flags } = vNode
  if (flags & FLAG_MEMO) {
    vNode.memoizedProps = props
    if (
      prev?.memoizedProps &&
      vNode.arePropsEqual!(prev.memoizedProps, props) &&
      !vNode.hmrUpdated
    ) {
      vNode.flags |= FLAG_NOOP
      return false
    }
    vNode.flags &= ~FLAG_NOOP
  }
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
        subs.forEach((unsub) => unsub())
        subs.clear()
      }

      if (__DEV__) {
        newChild = latest(type)(props)

        if (vNode.hmrUpdated && vNode.hooks && vNode.hookSig) {
          const len = vNode.hooks.length
          if (hookIndex.current < len) {
            // clean up any hooks that were removed
            for (let i = hookIndex.current; i < len; i++) {
              const hook = vNode.hooks[i]
              hook.cleanup?.()
            }
            vNode.hooks.length = hookIndex.current
            vNode.hookSig.length = hookIndex.current
          }
        }

        delete vNode.hmrUpdated
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
      newChild = type(props)
    } while (isRenderDirtied)
    vNode.child = reconcileChildren(vNode, newChild)
    return true
  } finally {
    node.current = null
  }
}

function updateHostComponent(vNode: DomVNode) {
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
    if (__DEV__) {
      if (vNode.dom instanceof Element) {
        vNode.dom.__kiruNode = vNode
      }
    }
  }
  // text should _never_ have children
  if (type !== "#text") {
    vNode.child = reconcileChildren(vNode, props.children)
    if (vNode.child && renderMode.current === "hydrate") {
      hydrationStack.push(vNode.dom!)
    }
  }
}

function checkForTooManyConsecutiveDirtyRenders() {
  if (consecutiveDirtyCount > CONSECUTIVE_DIRTY_LIMIT) {
    throw new KiruError(
      "Maximum update depth exceeded. This can happen when a component repeatedly calls setState during render or in useLayoutEffect. Kiru limits the number of nested updates to prevent infinite loops."
    )
  }
}

function flushEffects(effectArr: Function[]) {
  for (let i = 0; i < effectArr.length; i++) {
    effectArr[i]()
  }
  effectArr.length = 0
}
