import { svgTags, FLAG_PLACEMENT, FLAG_STATIC_DOM } from "../constants.js"
import { Signal } from "../signals/base.js"
import { unwrap } from "../signals/utils.js"
import { hydrationStack } from "../hydration.js"
import { isValidTextChild } from "../utils/index.js"
import { KiruError } from "../error.js"
import { subTextNode } from "./props.js"
import type { DomVNode, ElementVNode, MaybeDom, SomeDom } from "../types.utils"

type VNode = Kiru.VNode

export type HostNode = {
  node: ElementVNode
  lastChild?: SomeDom
}

export function createDom(vNode: DomVNode): SomeDom {
  const t = vNode.type
  const dom =
    t == "#text"
      ? createTextNode(vNode)
      : svgTags.has(t)
        ? document.createElementNS("http://www.w3.org/2000/svg", t)
        : document.createElement(t)

  return dom
}

function createTextNode(vNode: VNode): Text {
  const { nodeValue } = vNode.props
  if (Signal.isSignal(nodeValue)) {
    return createSignalTextNode(vNode, nodeValue)
  }

  return document.createTextNode(nodeValue)
}

function createSignalTextNode(vNode: VNode, nodeValue: Signal<string>): Text {
  const value = nodeValue.peek() ?? ""
  const textNode = document.createTextNode(value)
  subTextNode(vNode, textNode, nodeValue)
  return textNode
}

export function getOrCreateTextNode(vNode: VNode): MaybeDom {
  const sig = vNode.props.nodeValue
  if (!Signal.isSignal(sig)) {
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

export function hydrateDom(vNode: VNode) {
  const dom =
    vNode.type === "#text"
      ? getOrCreateTextNode(vNode)
      : hydrationStack.getCurrentChild()

  hydrationStack.bumpChildIndex()

  if (!dom) {
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
    throw new KiruError({
      message: `Hydration mismatch - expected node of type ${vNode.type.toString()} but received ${nodeName}`,
      vNode,
    })
  }
  vNode.dom = dom
  if (vNode.type !== "#text" && !(vNode.flags & FLAG_STATIC_DOM)) {
    // updateDom is called later during commit phase
    return
  }
  if (Signal.isSignal(vNode.props.nodeValue)) {
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
    if (Signal.isSignal(sib.props.nodeValue)) {
      subTextNode(sib, dom, sib.props.nodeValue)
    }
    prev = sibling
    sibling = sibling.sibling
  }
}

export function getDomParent(vNode: VNode): ElementVNode {
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

export function placeDom(vNode: DomVNode, hostNode: HostNode) {
  const { node: parentVNodeWithDom, lastChild } = hostNode
  const dom = vNode.dom
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

export function getNextSiblingDom(
  vNode: VNode,
  parent: ElementVNode
): MaybeDom {
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

export function findFirstHostDom(vNode: VNode): MaybeDom {
  let node: VNode | null = vNode

  while (node) {
    if (node.dom) return node.dom
    if (node.flags & FLAG_STATIC_DOM) return
    node = node.child
  }
  return
}

