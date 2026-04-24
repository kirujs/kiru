import { $FRAGMENT, $INLINE_FN, svgTags } from "../constants.js"
import { owner, postEffectCleanups } from "../globals.js"
import type { KiruNodeMeta, NodeRange } from "./metadata.js"
import { getAttachedNodeMeta, getNodeMeta, setNodeMeta } from "./metadata.js"
import { createRange } from "./range.js"
import { reconcileChildren } from "./reconcile.js"
import { queueOwnerLifecycleHooks, requestUpdate } from "../scheduler.js"
import { applyProps, removeProp } from "./runtime-props.js"
import { Signal } from "../signals/base.js"
import { setRef } from "../utils/runtime.js"

export function isElementLike(value: unknown): value is Kiru.Element {
  return typeof value === "object" && !!value && "type" in (value as object)
}

function createKiruNode(
  element: Kiru.Element,
  index: number,
  parent: Kiru.KiruNode | null = owner.current
): Kiru.KiruNode {
  return {
    type: element.type,
    props: element.props,
    key: element.key,
    parent,
    index,
  }
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

function createHostElement(tagName: string): Element {
  return svgTags.has(tagName)
    ? document.createElementNS(SVG_NAMESPACE, tagName)
    : document.createElement(tagName)
}

function normalizeChildrenInput(children: unknown): unknown[] {
  if (Array.isArray(children))
    return children.filter(
      (c) => c !== null && c !== undefined && c !== false && c !== true
    )
  if (
    children === null ||
    children === undefined ||
    children === false ||
    children === true
  )
    return []
  return [children]
}

function renderFunction(node: Kiru.KiruNode): unknown {
  owner.current = node
  node.unsubs?.forEach((u) => u())
  node.unsubs = []
  let result: unknown
  if (node.render) result = node.render(node.props)
  else {
    const first = (node.type as Function)(node.props)
    if (typeof first === "function") {
      node.render = first
      result = first(node.props)
    } else result = first
  }
  owner.current = null
  return result
}

export function createChild(
  child: unknown,
  index = 0,
  parent: Kiru.KiruNode | null = owner.current
): Node[] {
  if (Signal.isSignal(child)) {
    const text = document.createTextNode(String(child.peek() ?? ""))
    const unsubscribe = child.subscribe((v) => {
      text.nodeValue = String(v ?? "")
    })
    setNodeMeta(text, {
      type: "#text",
      props: {},
      key: null,
      parent,
      index,
      unsubs: [unsubscribe],
    } as KiruNodeMeta)
    return [text]
  }
  if (typeof child === "string" || typeof child === "number") {
    return [document.createTextNode(String(child))]
  }
  if (Array.isArray(child)) {
    const rangeKiruNode: Kiru.KiruNode = {
      type: $FRAGMENT,
      props: { children: child, IS_ARRAY: true },
      key: null,
      parent,
      index,
    }
    const range = createRange(rangeKiruNode)
    const nodes = child.flatMap((value, i) =>
      createChild(value, i, rangeKiruNode)
    )
    return [range.start, ...nodes, range.end]
  }
  if (typeof child === "function") {
    const node: Kiru.KiruNode = {
      type: $INLINE_FN,
      props: { expr: child },
      key: null,
      parent,
      index,
      render: () => (child as () => unknown)(),
    }
    const result = renderFunction(node)
    const rendered = createChild(result, 0, node)
    if (rendered.length === 1 && rendered[0].nodeType !== Node.COMMENT_NODE) {
      node.rootNode = rendered[0]
      const meta = getNodeMeta(rendered[0])
      if (meta) meta.component = node as KiruNodeMeta
      else setNodeMeta(rendered[0], node as KiruNodeMeta)
      return rendered
    }
    const range = createRange(node)
    return [range.start, ...rendered, range.end]
  }
  if (!isElementLike(child)) return []

  const node = createKiruNode(child, index, parent)
  if (typeof node.type === "string") {
    const el = createHostElement(node.type)
    setNodeMeta(el, node as KiruNodeMeta)
    applyProps(el, child.props)
    const children = child.props.children
    if (Array.isArray(children)) {
      children.forEach((c, i) =>
        createChild(c, i, node).forEach((n) => el.appendChild(n))
      )
    } else if (children !== undefined) {
      createChild(children, 0, node).forEach((n) => el.appendChild(n))
    }
    return [el]
  }

  if (node.type === $FRAGMENT) {
    const range = createRange(node)
    const children = Array.isArray(child.props.children)
      ? child.props.children
      : [child.props.children]
    const nodes = children.flatMap((c, i) => createChild(c, i, node))
    return [range.start, ...nodes, range.end]
  }

  const result = renderFunction(node)
  queueOwnerLifecycleHooks(node)
  const rendered = createChild(result, 0, node)
  if (rendered.length === 1 && rendered[0].nodeType !== Node.COMMENT_NODE) {
    node.rootNode = rendered[0]
    const meta = getNodeMeta(rendered[0])
    if (meta) meta.component = node
    else setNodeMeta(rendered[0], node as KiruNodeMeta)
    return rendered
  }
  const range = createRange(node)
  return [range.start, ...rendered, range.end]
}

function clearRange(range: NodeRange): void {
  let node = range.start.nextSibling
  while (node && node !== range.end) {
    const next = node.nextSibling
    unmount(node)
    node = next
  }
}

export function updateFunctionOwner(node: Kiru.KiruNode): void {
  const result = renderFunction(node)
  node.dirty = false
  if (node.rootNode) {
    if (typeof result === "string" || typeof result === "number") {
      if (node.rootNode.nodeType === Node.TEXT_NODE) {
        node.rootNode.nodeValue = String(result)
        return
      }
    }
    const replacement = createChild(result, 0, node)
    if (
      replacement.length === 1 &&
      replacement[0].nodeType !== Node.COMMENT_NODE
    ) {
      node.rootNode.parentNode?.insertBefore(replacement[0], node.rootNode)
      unmount(node.rootNode)
      node.rootNode = replacement[0]
      return
    }
    const range = createRange(node)
    node.rootNode.parentNode?.insertBefore(range.start, node.rootNode)
    node.rootNode.parentNode?.insertBefore(range.end, node.rootNode.nextSibling)
    unmount(node.rootNode)
    node.rootNode = undefined
  }

  const range = node.range
  if (!range) return
  if (
    result === null ||
    result === undefined ||
    result === false ||
    result === true ||
    result === ""
  ) {
    clearRange(range)
    return
  }
  if (typeof result === "string" || typeof result === "number") {
    clearRange(range)
    range.start.after(document.createTextNode(String(result)))
    return
  }
  if (Array.isArray(result)) reconcileChildren(range, result)
  else {
    const existing = range.start.nextSibling
    if (!existing || existing === range.end) {
      const nodes = createChild(result, 0, node)
      if (nodes.length) range.start.after(...nodes)
      return
    }
    if (!updateChildInPlace(existing, result)) {
      clearRange(range)
      const nodes = createChild(result, 0, node)
      if (nodes.length) range.start.after(...nodes)
    }
  }
}

export function updateChildInPlace(oldNode: Node, nextChild: unknown): boolean {
  if (
    oldNode.nodeType === Node.TEXT_NODE &&
    (typeof nextChild === "string" || typeof nextChild === "number")
  ) {
    oldNode.nodeValue = String(nextChild)
    return true
  }
  const rawMeta = getAttachedNodeMeta(oldNode)
  const meta = (rawMeta?.component ?? rawMeta) as KiruNodeMeta | undefined
  if (!meta) return false
  if (
    typeof meta.type === "function" &&
    isElementLike(nextChild) &&
    nextChild.type === meta.type
  ) {
    meta.props = nextChild.props
    requestUpdate(meta)
    return true
  }
  if (meta.type === $INLINE_FN && typeof nextChild === "function") {
    meta.props = { expr: nextChild }
    meta.render = () => nextChild()
    requestUpdate(meta)
    return true
  }
  const hostMeta = rawMeta && typeof rawMeta.type === "string" ? rawMeta : meta
  if (
    oldNode.nodeType === Node.ELEMENT_NODE &&
    isElementLike(nextChild) &&
    nextChild.type === hostMeta.type
  ) {
    const element = oldNode as Element
    const elementMeta = getAttachedNodeMeta(element)
    for (const key of Object.keys(hostMeta.props)) {
      if (key !== "children" && !(key in nextChild.props)) {
        if (key.startsWith("on")) {
          const handlers = elementMeta?.eventHandlers
          const handler = handlers?.[key]
          if (handler) {
            element.removeEventListener(
              key.replace(/^on:?/, "").toLowerCase(),
              handler
            )
            delete handlers[key]
          }
          continue
        }
        if (key.startsWith("bind:")) {
          elementMeta?.signalPropSubscriptions?.[key]?.()
          if (elementMeta?.signalPropSubscriptions) {
            delete elementMeta.signalPropSubscriptions[key]
          }
          continue
        }
        removeProp(
          element,
          key,
          (hostMeta.props as Record<string, unknown>)[key]
        )
      }
    }
    applyProps(
      element,
      nextChild.props,
      (hostMeta.props as Record<string, unknown>) ?? {}
    )
    hostMeta.props = nextChild.props
    const nextChildren = normalizeChildrenInput(nextChild.props.children)
    const oldChildren = Array.from(element.childNodes)
    const keyed =
      nextChildren.length > 0 &&
      nextChildren.some(
        (child) =>
          isElementLike(child) && child.key !== null && child.key !== undefined
      )
    if (keyed) {
      const keyToOldNode = new Map<JSX.ElementKey, Node>()
      oldChildren.forEach((child) => {
        const key = getNodeMeta(child)?.key
        if (key !== null && key !== undefined) keyToOldNode.set(key, child)
      })
      const ordered: Node[] = []
      nextChildren.forEach((value, childIndex) => {
        if (
          isElementLike(value) &&
          value.key !== null &&
          value.key !== undefined
        ) {
          const existing = keyToOldNode.get(value.key)
          if (existing) {
            updateChildInPlace(existing, value)
            ordered.push(existing)
            keyToOldNode.delete(value.key)
            return
          }
        }
        ordered.push(...createChild(value, childIndex, hostMeta))
      })
      keyToOldNode.forEach((node) => unmount(node))
      element.replaceChildren(...ordered)
    } else {
      const frag = document.createDocumentFragment()
      nextChildren.forEach((value, childIndex) =>
        createChild(value, childIndex, hostMeta).forEach((n) =>
          frag.appendChild(n)
        )
      )
      while (element.firstChild) unmount(element.firstChild)
      element.appendChild(frag)
    }
    return true
  }
  if (
    oldNode.nodeType === Node.COMMENT_NODE &&
    (oldNode as Comment).data === "$" &&
    meta.range &&
    Array.isArray(nextChild)
  ) {
    reconcileChildren(meta.range, nextChild)
    meta.props = { children: nextChild }
    return true
  }
  return false
}

export function unmount(node: Node): void {
  const runOwnerTeardown = (meta: KiruNodeMeta | null | undefined) => {
    if (!meta) return
    meta.unsubs?.forEach((u) => u())
    if (meta.cleanups) Object.values(meta.cleanups).forEach((fn) => fn())
    if (meta.hooks) {
      const { preCleanups, postCleanups } = meta.hooks
      preCleanups.forEach((fn) => fn())
      postEffectCleanups.push(...postCleanups)
      preCleanups.length = postCleanups.length = 0
    }
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    const comment = node as Comment
    const meta = getNodeMeta(comment)
    if (comment.data === "$" && meta?.range?.start === comment) {
      let cur: Node | null = meta.range.start
      while (cur) {
        const next: Node | null =
          cur === meta.range.end ? null : cur.nextSibling
        if (cur !== meta.range.start && cur !== meta.range.end) unmount(cur)
        cur.parentNode?.removeChild(cur)
        if (cur === meta.range.end) break
        cur = next
      }
      runOwnerTeardown(meta)
      meta.unmounted = true
      return
    }
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    while (el.firstChild) unmount(el.firstChild)
    const attachedMeta = getAttachedNodeMeta(el)
    if (attachedMeta?.eventHandlers) {
      for (const [key, handler] of Object.entries(attachedMeta.eventHandlers)) {
        el.removeEventListener(key.replace(/^on:?/, "").toLowerCase(), handler)
      }
    }
    if (attachedMeta?.signalPropSubscriptions) {
      Object.values(attachedMeta.signalPropSubscriptions).forEach((u) => u())
    }
    runOwnerTeardown(getNodeMeta(el))
    const ref = attachedMeta?.props?.ref as Kiru.Ref<Element | null> | undefined
    if (ref) setRef(ref, null)
    node.parentNode?.removeChild(node)
    return
  }
  runOwnerTeardown(getNodeMeta(node))
  node.parentNode?.removeChild(node)
}
