import type { AppContext } from "./appContext"
import type { FunctionVNode } from "./types.utils"
import { flags } from "./flags.js"
import { $MEMO, CONSECUTIVE_DIRTY_LIMIT, FLAG } from "./constants.js"
import { commitWork, createDom, hydrateDom } from "./dom.js"
import { __DEV__ } from "./env.js"
import { KaiokenError } from "./error.js"
import { ctx, node, nodeToCtxMap, renderMode } from "./globals.js"
import { hydrationStack } from "./hydration.js"
import { assertValidElementProps } from "./props.js"
import { reconcileChildren } from "./reconciler.js"
import { isExoticVNode, latest, traverseApply, vNodeContains } from "./utils.js"
import { isMemoFn } from "./memo.js"

type VNode = Kaioken.VNode

export class Scheduler {
  private nextUnitOfWork: VNode | undefined = undefined
  private treesInProgress: VNode[] = []
  private currentTreeIndex = 0
  private isRunning = false
  private nextIdleEffects: ((scheduler: this) => void)[] = []
  private deletions: VNode[] = []
  private frameDeadline = 0
  private pendingCallback: IdleRequestCallback | undefined
  private channel: MessageChannel
  private frameHandle: number | null = null
  private isImmediateEffectsMode = false
  private immediateEffectDirtiedRender = false
  private isRenderDirtied = false
  private consecutiveDirtyCount = 0
  private effectCallbacks = {
    pre: [] as Function[],
    post: [] as Function[],
  }

  constructor(private appCtx: AppContext<any>, private maxFrameMs = 50) {
    const timeRemaining = () => this.frameDeadline - window.performance.now()
    const deadline = {
      didTimeout: false,
      timeRemaining,
    }
    this.channel = new MessageChannel()
    this.channel.port2.onmessage = () => {
      if (typeof this.pendingCallback === "function") {
        this.pendingCallback(deadline)
      }
    }
  }

  clear() {
    this.nextUnitOfWork = undefined
    this.treesInProgress = []
    this.currentTreeIndex = 0
    this.nextIdleEffects = []
    this.deletions = []
    this.effectCallbacks = { pre: [], post: [] }
    this.frameDeadline = 0
    this.pendingCallback = undefined
    this.sleep()
  }

  wake() {
    if (this.isRunning) return
    this.isRunning = true
    this.requestIdleCallback(this.workLoop.bind(this))
  }

  sleep() {
    this.isRunning = false
    if (this.frameHandle !== null) {
      globalThis.cancelAnimationFrame(this.frameHandle)
      this.frameHandle = null
    }
  }

  nextIdle(fn: (scheduler: this) => void, wakeUpIfIdle = true) {
    this.nextIdleEffects.push(fn)
    if (wakeUpIfIdle) this.wake()
  }

  flushSync() {
    if (this.frameHandle !== null) {
      globalThis.cancelAnimationFrame(this.frameHandle)
      this.frameHandle = null
    }
    this.workLoop()
  }

  queueUpdate(vNode: VNode) {
    if (vNode.prev?.memoizedProps) {
      delete vNode.prev.memoizedProps
    }
    if (this.isImmediateEffectsMode) {
      this.immediateEffectDirtiedRender = true
    }

    if (node.current === vNode) {
      this.isRenderDirtied = true
      return
    }

    if (this.nextUnitOfWork === vNode) {
      return
    }

    if (this.nextUnitOfWork === undefined) {
      this.treesInProgress.push(vNode)
      this.nextUnitOfWork = vNode
      return this.wake()
    }

    const treeIdx = this.treesInProgress.indexOf(vNode)
    // handle node as queued tree
    if (treeIdx !== -1) {
      if (treeIdx === this.currentTreeIndex) {
        this.treesInProgress[this.currentTreeIndex] = vNode
        this.nextUnitOfWork = vNode
      } else if (treeIdx < this.currentTreeIndex) {
        this.currentTreeIndex--
        this.treesInProgress.splice(treeIdx, 1)
        this.treesInProgress.push(vNode)
      }
      return
    }

    const nodeDepth = vNode.depth!
    // handle node as child of queued trees
    for (let i = 0; i < this.treesInProgress.length; i++) {
      const treeDepth = this.treesInProgress[i].depth!
      if (treeDepth > nodeDepth) continue
      if (vNodeContains(this.treesInProgress[i], vNode)) {
        if (i === this.currentTreeIndex) {
          // if req node is child of work node we can skip
          if (vNodeContains(this.nextUnitOfWork, vNode)) return
          // otherwise work node is a child of req node so we need to cancel & replace it
          this.nextUnitOfWork = vNode // jump back up the tree
        } else if (i < this.currentTreeIndex) {
          // already processed tree, create new tree with the node
          this.treesInProgress.push(vNode)
        }
        return
      }
    }

    let didNodeUsurp = false
    for (let i = 0; i < this.treesInProgress.length; i++) {
      // does node contain tree?
      const treeDepth = this.treesInProgress[i].depth!
      if (treeDepth < nodeDepth) continue

      if (vNodeContains(vNode, this.treesInProgress[i])) {
        // TODO: continue consuming trees in progress of the req node contains them!
        if (i === this.currentTreeIndex) {
          // node contains current tree, replace it
          if (!didNodeUsurp) {
            this.treesInProgress.splice(i, 1, vNode)
            this.nextUnitOfWork = vNode
            didNodeUsurp = true
          } else {
            this.treesInProgress.splice(i, 1)
          }
        } else if (i < this.currentTreeIndex) {
          // node contains a tree that has already been processed
          this.currentTreeIndex--
          this.treesInProgress.splice(i, 1)
          if (!didNodeUsurp) {
            this.treesInProgress.push(vNode)
          }
        } else {
          // node contains a tree that has not yet been processed, 'usurp' the tree
          if (!didNodeUsurp) {
            this.treesInProgress.splice(i, 1, vNode)
            didNodeUsurp = true
          } else {
            this.treesInProgress.splice(i, 1)
          }
        }
      }
    }
    if (didNodeUsurp) return
    // node is not a child or parent of any queued trees, queue new tree
    this.treesInProgress.push(vNode)
  }

  queueDelete(vNode: VNode) {
    traverseApply(vNode, (n) => (n.flags = flags.set(n.flags, FLAG.DELETION)))
    this.deletions.push(vNode)
  }

  private isFlushReady() {
    return (
      !this.nextUnitOfWork &&
      (this.deletions.length || this.treesInProgress.length)
    )
  }

  private workLoop(deadline?: IdleDeadline): void {
    ctx.current = this.appCtx
    while (this.nextUnitOfWork) {
      this.nextUnitOfWork =
        this.performUnitOfWork(this.nextUnitOfWork) ??
        this.treesInProgress[++this.currentTreeIndex]

      if ((deadline?.timeRemaining() ?? 1) < 1) break
    }

    if (this.isFlushReady()) {
      while (this.deletions.length) {
        commitWork(this.deletions.shift()!)
      }
      const treesInProgress = [...this.treesInProgress]
      this.treesInProgress = []
      this.currentTreeIndex = 0
      for (const tree of treesInProgress) {
        commitWork(tree)
      }

      this.isImmediateEffectsMode = true
      this.flushEffects(this.effectCallbacks.pre)
      this.isImmediateEffectsMode = false

      if (this.immediateEffectDirtiedRender) {
        this.checkForTooManyConsecutiveDirtyRenders()
        this.flushEffects(this.effectCallbacks.post)
        this.immediateEffectDirtiedRender = false
        this.consecutiveDirtyCount++
        return this.workLoop()
      }
      this.consecutiveDirtyCount = 0

      this.flushEffects(this.effectCallbacks.post)
      window.__kaioken!.emit("update", this.appCtx)
    }

    if (!this.nextUnitOfWork) {
      this.sleep()
      while (this.nextIdleEffects.length) {
        this.nextIdleEffects.shift()!(this)
      }
      return
    }

    this.requestIdleCallback(this.workLoop.bind(this))
  }

  private requestIdleCallback(callback: IdleRequestCallback) {
    this.frameHandle = globalThis.requestAnimationFrame((time) => {
      this.frameDeadline = time + this.maxFrameMs
      this.pendingCallback = callback
      this.channel.port1.postMessage(null)
    })
  }

  private performUnitOfWork(vNode: VNode): VNode | void {
    let renderChild = true
    try {
      const { type, props } = vNode
      if (typeof type === "function") {
        renderChild = this.updateFunctionComponent(vNode as FunctionVNode)
      } else if (isExoticVNode(vNode)) {
        vNode.child =
          reconcileChildren(
            this.appCtx,
            vNode,
            vNode.child || null,
            props.children
          ) || undefined
      } else {
        this.updateHostComponent(vNode)
      }
    } catch (error) {
      window.__kaioken?.emit(
        "error",
        this.appCtx,
        error instanceof Error ? error : new Error(String(error))
      )
      if (KaiokenError.isKaiokenError(error)) {
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

    if (renderChild && vNode.child) {
      return vNode.child
    }

    let nextNode: VNode | undefined = vNode
    while (nextNode) {
      // queue effects upon ascent
      if (nextNode.immediateEffects) {
        this.effectCallbacks.pre.push(...nextNode.immediateEffects)
        nextNode.immediateEffects = undefined
      }
      if (nextNode.effects) {
        this.effectCallbacks.post.push(...nextNode.effects)
        nextNode.effects = undefined
      }
      if (nextNode === this.treesInProgress[this.currentTreeIndex]) return
      if (nextNode.sibling) {
        return nextNode.sibling
      }

      nextNode = nextNode.parent
      if (renderMode.current === "hydrate" && nextNode?.dom) {
        hydrationStack.pop()
      }
    }
  }

  private updateFunctionComponent(vNode: FunctionVNode) {
    const { type, props } = vNode
    if (isMemoFn(type)) {
      vNode.memoizedProps = props
      if (
        vNode.prev?.memoizedProps &&
        type[$MEMO].arePropsEqual(vNode.prev.memoizedProps, props) &&
        !vNode.hmrUpdated
      ) {
        return false
      }
    }
    try {
      node.current = vNode
      nodeToCtxMap.set(vNode, this.appCtx)
      let newChildren
      let renderTryCount = 0
      do {
        this.isRenderDirtied = false
        this.appCtx.hookIndex = 0
        newChildren = latest(type)(props)
        if (__DEV__) {
          delete vNode.hmrUpdated
        }
        if (++renderTryCount > CONSECUTIVE_DIRTY_LIMIT) {
          throw new KaiokenError({
            message:
              "Too many re-renders. Kaioken limits the number of renders to prevent an infinite loop.",
            fatal: true,
            vNode,
          })
        }
      } while (this.isRenderDirtied)
      vNode.child =
        reconcileChildren(
          this.appCtx,
          vNode,
          vNode.child || null,
          newChildren
        ) || undefined
      return true
    } finally {
      node.current = undefined
    }
  }

  private updateHostComponent(vNode: VNode) {
    try {
      node.current = vNode
      assertValidElementProps(vNode)
      if (!vNode.dom) {
        if (renderMode.current === "hydrate") {
          hydrateDom(vNode)
        } else {
          vNode.dom = createDom(vNode)
        }
        if (__DEV__) {
          // @ts-expect-error we apply vNode to the dom node
          vNode.dom!.__kaiokenNode = vNode
        }
      }

      vNode.child =
        reconcileChildren(
          this.appCtx,
          vNode,
          vNode.child || null,
          vNode.props.children
        ) || undefined

      if (vNode.child && renderMode.current === "hydrate") {
        hydrationStack.push(vNode.dom!)
      }
    } finally {
      node.current = undefined
    }
  }

  private checkForTooManyConsecutiveDirtyRenders() {
    if (this.consecutiveDirtyCount > CONSECUTIVE_DIRTY_LIMIT) {
      throw new KaiokenError(
        "Maximum update depth exceeded. This can happen when a component repeatedly calls setState during render or in useLayoutEffect. Kaioken limits the number of nested updates to prevent infinite loops."
      )
    }
  }

  private flushEffects(effectArr: Function[]) {
    while (effectArr.length) effectArr.shift()!()
  }
}
