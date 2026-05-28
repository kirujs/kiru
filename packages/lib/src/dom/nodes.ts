import {
  $INLINE_FN,
  svgTags,
  FLAG_PLACEMENT,
  FLAG_STATIC_DOM,
  FLAG_TEMPLATE,
} from "../constants.js"
import { isSignal, type Signal } from "../signals/base.js"
import { unwrap } from "../signals/utils.js"
import {
  hydrationStack,
  traceHydrationCursorContext,
  traceHydrationError,
} from "../hydration.js"
import { withPendingTemplateHoleHydration } from "../templateHoleHydration.js"
import {
  getVNodeApp,
  isValidTextChild,
  latest,
  registerVNodeCleanup,
} from "../utils/index.js"
import { KiruError } from "../error.js"
import { __DEV__, isBrowser } from "../env.js"
import type {
  DomVNode,
  ElementVNode,
  MaybeDom,
  SomeDom,
} from "../types.utils.js"
import { updateDomProps } from "./props.js"

export { createDom, hydrateDom, getDomParent, placeDom }

type VNode = Kiru.VNode

export type HostNode = {
  node: ElementVNode
  lastChild?: SomeDom
}

function createDom(vNode: DomVNode): SomeDom {
  const t = vNode.type
  const dom =
    t == "#text"
      ? createTextNode(vNode)
      : svgTags.has(t)
      ? document.createElementNS("http://www.w3.org/2000/svg", t)
      : document.createElement(t)

  return dom
}

function hydrateDom(vNode: VNode) {
  withPendingTemplateHoleHydration(vNode, () =>
    hydrateDomAtCurrentCursor(vNode)
  )
}

function hydrateDomAtCurrentCursor(vNode: VNode) {
  traceHydrationCursorContext(`dom:${String(vNode.type)}`)
  // if (vNode.props["data-testid"] === "ssr-user") debugger
  // if (vNode.props.children === "Home") debugger
  if (vNode.flags & FLAG_TEMPLATE) {
    return
  }
  const dom =
    vNode.type === "#text"
      ? getOrCreateTextNode(vNode)
      : hydrationStack.getCurrentChild()

  hydrationStack.bumpChildIndex()

  if (!dom && vNode.type === "#text") {
    const split = trySplitMergedInlineTextNode(vNode)
    if (split) {
      vNode.dom = split
      if (isSignal(vNode.props.nodeValue)) {
        subTextNode(vNode, split, vNode.props.nodeValue)
      }
      return
    }
  }

  if (!dom) {
    traceHydrationError(`Hydration mismatch - no node found (${String(vNode.type)})`)
    throw new KiruError({
      message: `Hydration mismatch - no node found`,
      vNode,
    })
  }
  let nodeName = dom.nodeName
  if (!svgTags.has(nodeName)) {
    nodeName = nodeName.toLowerCase()
  }
  if ((vNode.type as string) !== nodeName) {
    traceHydrationError(
      `Hydration mismatch - expected ${String(vNode.type)} but received ${nodeName}`
    )
    throw new KiruError({
      message: `Hydration mismatch - expected node of type ${vNode.type.toString()} but received ${nodeName}`,
      vNode,
    })
  }
  vNode.dom = dom
  if (vNode.type !== "#text" && !(vNode.flags & FLAG_STATIC_DOM)) {
    updateDomProps(vNode as DomVNode)
    return
  }
  if (isSignal(vNode.props.nodeValue)) {
    subTextNode(vNode, dom as Text, vNode.props.nodeValue)
  }

  let prev = vNode
  let sibling = vNode.sibling
  while (sibling && sibling.type === "#text") {
    const sib = sibling
    hydrationStack.bumpChildIndex()
    const prevText = String(unwrap(prev.props.nodeValue) ?? "")
    const dom = (prev.dom as Text).splitText(prevText.length)
    sib.dom = dom
    if (isSignal(sib.props.nodeValue)) {
      subTextNode(sib, dom, sib.props.nodeValue)
    }
    prev = sibling
    sibling = sibling.sibling
  }
}

function trySplitMergedInlineTextNode(vNode: VNode): Text | null {
  const inlineParent = vNode.parent
  const hostParent = inlineParent?.parent
  if (!inlineParent || !hostParent || inlineParent.type !== $INLINE_FN) {
    return null
  }
  let prev: VNode | null = null
  let node = hostParent.child
  while (node && node !== inlineParent) {
    prev = node
    node = node.sibling
  }
  if (!prev || prev.type !== "#text" || !(prev.dom instanceof Text)) {
    return null
  }
  const prevText = String(unwrap(prev.props.nodeValue) ?? "")
  return prev.dom.splitText(prevText.length)
}

function getDomParent(vNode: VNode): ElementVNode {
  let parentNode: VNode | null = vNode.parent
  let parentNodeElement = parentNode?.dom
  while (parentNode && !parentNodeElement) {
    parentNode = parentNode.parent
    parentNodeElement = parentNode?.dom
  }

  if (!parentNodeElement || !parentNode) {
    if (!vNode.parent && vNode.dom) {
      return vNode as ElementVNode
    }

    throw new KiruError({
      message: "No DOM parent found while attempting to place node.",
      vNode: vNode,
    })
  }
  return parentNode as ElementVNode
}

/** Hole payloads mount before the shell anchor; inner DOM uses normal placement. */
function resolveTemplateHoleAnchor(vNode: VNode): Comment | null {
  let parent = vNode.parent
  while (parent) {
    if (parent.templateHoleAnchor) return parent.templateHoleAnchor
    parent = parent.parent
  }
  return null
}

function placeDom(vNode: DomVNode, hostNode: HostNode) {
  const { node: parentVNodeWithDom, lastChild } = hostNode
  const dom = vNode.dom
  const holeAnchor =
    parentVNodeWithDom.templateHoleAnchor ??
    (vNode.parent !== parentVNodeWithDom
      ? resolveTemplateHoleAnchor(vNode)
      : null)
  const insertParent = holeAnchor?.parentNode
  if (insertParent) {
    insertParent.insertBefore(dom, holeAnchor)
    return
  }
  if (lastChild) {
    lastChild.after(dom)
    return
  }
  const nextSiblingDom = getNextSiblingDom(vNode, parentVNodeWithDom)
  if (nextSiblingDom) {
    parentVNodeWithDom.dom.insertBefore(dom, nextSiblingDom)
    return
  }

  parentVNodeWithDom.dom.appendChild(dom)
}

function getNextSiblingDom(vNode: VNode, parent: ElementVNode): MaybeDom {
  let node: VNode | null = vNode

  while (node) {
    let sibling = node.sibling

    while (sibling) {
      if (!(sibling.flags & (FLAG_PLACEMENT | FLAG_STATIC_DOM))) {
        const dom = findFirstHostDom(sibling)
        if (dom?.isConnected) return dom
      }
      sibling = sibling.sibling
    }

    node = node.parent
    if (!node || node.flags & FLAG_STATIC_DOM || node === parent) {
      return
    }
  }

  return
}

function findFirstHostDom(vNode: VNode): MaybeDom {
  let node: VNode | null = vNode
  while (node) {
    if (node.dom) return node.dom
    if (node.flags & FLAG_STATIC_DOM) return
    node = node.child
  }
  return
}

function getOrCreateTextNode(vNode: VNode): MaybeDom {
  const sig = vNode.props.nodeValue
  if (!isSignal(sig)) {
    return hydrationStack.getCurrentChild()
  }

  const value = sig.peek()
  if (isValidTextChild(value)) {
    return hydrationStack.getCurrentChild()
  }

  const dom = createSignalTextNode(vNode, sig)
  const currentChild = hydrationStack.getCurrentChild()

  if (!currentChild) {
    return hydrationStack.getCurrentParent().appendChild(dom)
  }

  currentChild.before(dom)
  return dom
}

function subTextNode(vNode: VNode, textNode: Text, signal: Signal<string>) {
  if (__DEV__) signal = latest(signal)
  const cleanup = signal.subscribe((value, prev) => {
    if (value === prev) return
    textNode.nodeValue = value
    if (__DEV__ && isBrowser) {
      window.__kiru?.profilingContext?.emit(
        "signalTextUpdate",
        getVNodeApp(vNode)!
      )
    }
  })
  registerVNodeCleanup(vNode, "nodeValue", cleanup)
}

function createTextNode(vNode: VNode): Text {
  const { nodeValue } = vNode.props
  if (isSignal(nodeValue)) {
    return createSignalTextNode(vNode, nodeValue)
  }

  return document.createTextNode(nodeValue)
}

function createSignalTextNode(vNode: VNode, nodeValue: Signal<string>): Text {
  if (__DEV__) nodeValue = latest(nodeValue) as Signal<string>
  const value = nodeValue.peek() ?? ""
  const textNode = document.createTextNode(value)
  subTextNode(vNode, textNode, nodeValue)
  return textNode
}
