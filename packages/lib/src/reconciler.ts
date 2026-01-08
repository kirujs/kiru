import {
  $FRAGMENT,
  FLAG_MEMO,
  FLAG_PLACEMENT,
  FLAG_UPDATE,
} from "./constants.js"
import {
  getVNodeAppContext,
  isElement,
  isValidTextChild,
  latest,
} from "./utils/index.js"
import { Signal } from "./signals/base.js"
import { __DEV__ } from "./env.js"
import type { AppContext } from "./appContext.js"
import { isMemoFn } from "./components/memo.js"
import { createVNode as createBaseVNode } from "./vNode.js"

type VNode = Kiru.VNode
type KElement = Kiru.Element
let appCtx: AppContext

export function reconcileChildren(
  parent: VNode,
  children: unknown
): VNode | null {
  if (__DEV__) {
    appCtx = getVNodeAppContext(parent)!
  }
  if (Array.isArray(children)) {
    if (__DEV__) {
      // array children are 'tagged' during parent reconciliation pass
      if ($LIST_CHILD in children) {
        checkForMissingKeys(parent, children)
      }
      checkForDuplicateKeys(parent, children)
    }
    return reconcileChildrenArray(parent, children)
  }
  return reconcileSingleChild(parent, children)
}

function reconcileSingleChild(parent: VNode, child: unknown): VNode | null {
  const oldChild = parent.child
  if (oldChild === null) {
    return createChild(parent, child)
  }
  const oldSibling = oldChild.sibling
  const newNode = updateSlot(parent, oldChild, child)
  if (newNode !== null) {
    if (oldChild && oldChild !== newNode && !newNode.prev) {
      deleteRemainingChildren(parent, oldChild)
    } else if (oldSibling) {
      deleteRemainingChildren(parent, oldSibling)
    }
    return newNode
  }
  {
    // handle keyed children array -> keyed child
    const existingChildren = mapRemainingChildren(oldChild)
    const newNode = updateFromMap(existingChildren, parent, 0, child)
    if (newNode !== null) {
      const prev = newNode.prev
      if (prev !== null) {
        const key = prev.key
        // node persisted, remove it from the list so it doesn't get deleted
        existingChildren.delete(key === null ? prev.index : key)
      }
      placeChild(newNode, 0, 0)
    }
    existingChildren.forEach((child) => deleteChild(parent, child))
    return newNode
  }
}

function reconcileChildrenArray(parent: VNode, children: unknown[]) {
  let resultingChild: VNode | null = null
  let prevNewChild: VNode | null = null

  let oldChild = parent.child
  let nextOldChild = null
  let lastPlacedIndex = 0
  let newIdx = 0

  for (; oldChild !== null && newIdx < children.length; newIdx++) {
    if (oldChild.index > newIdx) {
      nextOldChild = oldChild
      oldChild = null
    } else {
      nextOldChild = oldChild.sibling
    }
    const newChild = updateSlot(parent, oldChild, children[newIdx])
    if (newChild === null) {
      if (oldChild === null) {
        oldChild = nextOldChild
      }
      break
    }
    if (oldChild && !newChild.prev) {
      deleteChild(parent, oldChild)
    }
    lastPlacedIndex = placeChild(newChild, lastPlacedIndex, newIdx)
    if (prevNewChild === null) {
      resultingChild = newChild
    } else {
      prevNewChild.sibling = newChild
    }
    prevNewChild = newChild
    oldChild = nextOldChild
  }

  // matched all children?
  if (newIdx === children.length) {
    deleteRemainingChildren(parent, oldChild)
    return resultingChild
  }

  // just some good ol' insertions, baby
  if (oldChild === null) {
    for (; newIdx < children.length; newIdx++) {
      const newNode = createChild(parent, children[newIdx])
      if (newNode === null) continue
      lastPlacedIndex = placeChild(newNode, lastPlacedIndex, newIdx)
      if (prevNewChild === null) {
        resultingChild = newNode
      } else {
        prevNewChild.sibling = newNode
      }
      prevNewChild = newNode
    }
    return resultingChild
  }

  // deal with mismatched keys / unmatched children
  const existingChildren = mapRemainingChildren(oldChild)

  for (; newIdx < children.length; newIdx++) {
    const newNode = updateFromMap(
      existingChildren,
      parent,
      newIdx,
      children[newIdx]
    )
    if (newNode !== null) {
      const prev = newNode.prev
      if (prev !== null) {
        const key = prev.key
        // node persisted, remove it from the list so it doesn't get deleted
        existingChildren.delete(key === null ? prev.index : key)
      }
      lastPlacedIndex = placeChild(newNode, lastPlacedIndex, newIdx)
      if (prevNewChild === null) {
        resultingChild = newNode
      } else {
        prevNewChild.sibling = newNode
      }
      prevNewChild = newNode
    }
  }

  existingChildren.forEach((child) => deleteChild(parent, child))
  return resultingChild
}

function updateSlot(
  parent: VNode,
  oldChild: VNode | null,
  child: unknown
): VNode | null {
  // Update the node if the keys match, otherwise return null.
  const key = oldChild === null ? null : oldChild.key
  if (isValidTextChild(child)) {
    if (key !== null) return null
    if (
      oldChild?.type === "#text" &&
      Signal.isSignal(oldChild.props.nodeValue)
    ) {
      return null
    }
    return updateTextNode(parent, oldChild, "" + child)
  }
  if (Signal.isSignal(child)) {
    if (!!oldChild && oldChild.props.nodeValue !== child) return null
    return updateTextNode(parent, oldChild, child)
  }
  if (isElement(child)) {
    if (child.key !== key) return null
    return updateNode(parent, oldChild, child)
  }
  if (Array.isArray(child)) {
    if (key !== null) return null
    if (__DEV__) {
      markListChild(child)
    }
    return updateFragment(parent, oldChild, child)
  }
  return null
}

function updateTextNode(
  parent: VNode,
  oldChild: VNode | null,
  content: string | Signal<JSX.PrimitiveChild>
): VNode {
  if (oldChild === null || oldChild.type !== "#text") {
    return createVNode(parent, "#text", { nodeValue: content })
  }

  if (__DEV__) {
    dev_emitUpdateNode()
  }
  const prev = oldChild.props.nodeValue
  if (prev !== content) {
    oldChild.props.nodeValue = content
    oldChild.flags |= FLAG_UPDATE
  }
  oldChild.sibling = null
  return oldChild
}

function updateNode(parent: VNode, oldChild: VNode | null, newChild: KElement) {
  let { type, props, key } = newChild
  if (__DEV__) {
    if (typeof type === "function") {
      type = latest(type)
    }
  }
  if (type === $FRAGMENT) {
    return updateFragment(
      parent,
      oldChild,
      (props.children as VNode[]) || [],
      props
    )
  }
  if (oldChild?.type === type) {
    if (__DEV__) {
      dev_emitUpdateNode()
    }
    oldChild.index = 0
    oldChild.sibling = null
    if (typeof type === "string") {
      if (propsChanged(oldChild.props, props)) {
        oldChild.flags |= FLAG_UPDATE
      }
    } else {
      oldChild.flags |= FLAG_UPDATE
    }
    oldChild.props = props
    return oldChild
  }
  return createVNode(parent, type, props, key)
}

function updateFragment(
  parent: VNode,
  oldChild: VNode | null,
  children: unknown[],
  newProps = {}
) {
  if (oldChild === null || oldChild.type !== $FRAGMENT) {
    return createVNode(parent, $FRAGMENT, { children, ...newProps })
  }
  if (__DEV__) {
    dev_emitUpdateNode()
  }
  oldChild.props = { ...oldChild.props, ...newProps, children }
  oldChild.flags |= FLAG_UPDATE
  oldChild.sibling = null
  return oldChild
}

function createChild(parent: VNode, child: unknown): VNode | null {
  if (isValidTextChild(child)) {
    return createVNode(parent, "#text", { nodeValue: "" + child })
  }

  if (Signal.isSignal(child)) {
    return createVNode(parent, "#text", { nodeValue: child })
  }

  if (isElement(child)) {
    return createVNode(parent, child.type, child.props, child.key)
  }

  if (Array.isArray(child)) {
    if (__DEV__) {
      markListChild(child)
    }
    return createVNode(parent, $FRAGMENT, { children: child })
  }

  return null
}

function placeChild(
  child: VNode,
  lastPlacedIndex: number,
  newIndex: number
): number {
  child.index = newIndex
  const prev = child.prev
  if (prev !== null) {
    const oldIndex = prev.index
    if (oldIndex < lastPlacedIndex) {
      child.flags |= FLAG_PLACEMENT
      return lastPlacedIndex
    } else {
      return oldIndex
    }
  } else {
    child.flags |= FLAG_PLACEMENT
    return lastPlacedIndex
  }
}

function updateFromMap(
  existingChildren: Map<JSX.ElementKey, VNode>,
  parent: VNode,
  index: number,
  child: any
): VNode | null {
  const isSig = Signal.isSignal(child)
  if (isSig || isValidTextChild(child)) {
    const oldChild = existingChildren.get(index)
    if (oldChild) {
      if (oldChild.props.nodeValue === child) {
        return oldChild
      }
      if (
        oldChild.type === "#text" &&
        Signal.isSignal(oldChild.props.nodeValue)
      ) {
        oldChild.cleanups?.["nodeValue"]?.()
      }
    }

    return createVNode(parent, "#text", { nodeValue: child }, null, index)
  }

  if (isElement(child)) {
    const { type, props, key } = child
    const oldChild = existingChildren.get(key === null ? index : key)
    if (oldChild?.type === type) {
      if (__DEV__) {
        dev_emitUpdateNode()
      }
      if (typeof type === "string") {
        if (propsChanged(oldChild.props, props)) {
          oldChild.flags |= FLAG_UPDATE
        }
      } else {
        oldChild.flags |= FLAG_UPDATE
      }
      oldChild.props = props
      oldChild.sibling = null
      oldChild.index = index
      return oldChild
    }

    return createVNode(parent, type, props, key, index)
  }

  if (Array.isArray(child)) {
    const oldChild = existingChildren.get(index)
    if (__DEV__) {
      markListChild(child)
    }
    if (oldChild) {
      if (__DEV__) {
        dev_emitUpdateNode()
      }
      oldChild.flags |= FLAG_UPDATE
      oldChild.props.children = child
      return oldChild
    }

    return createVNode(parent, $FRAGMENT, { children: child }, null, index)
  }

  return null
}

function propsChanged(oldProps: VNode["props"], newProps: VNode["props"]) {
  const aKeys = Object.keys(oldProps)
  const bKeys = Object.keys(newProps)
  if (aKeys.length !== bKeys.length) return true
  for (let key of aKeys) {
    if (key === "children" || key === "key") continue
    if (oldProps[key] !== newProps[key]) return true
  }
  return false
}

function dev_emitUpdateNode() {
  if (!("window" in globalThis)) return
  window.__kiru.profilingContext?.emit("updateNode", appCtx)
}

const $LIST_CHILD = Symbol("kiru:marked-list-child")
function markListChild(children: unknown[]) {
  Object.assign(children, { [$LIST_CHILD]: true })
}

function mapRemainingChildren(child: VNode | null) {
  const map: Map<JSX.ElementKey, VNode> = new Map()
  while (child) {
    const key = child.key
    map.set(key === null ? child.index : key, child)
    child = child.sibling
  }
  return map
}

function deleteChild(parent: VNode, child: VNode) {
  if (parent.deletions === null) {
    parent.deletions = [child]
  } else {
    parent.deletions.push(child)
  }
}

function deleteRemainingChildren(parent: VNode, child: VNode | null) {
  while (child) {
    deleteChild(parent, child)
    child = child.sibling
  }
}

function checkForDuplicateKeys(parent: VNode, children: unknown[]) {
  const keys = new Set<string>()
  let warned = false
  for (const child of children) {
    if (!isElement(child)) continue
    const key = child.key
    if (typeof key === "string") {
      if (!warned && keys.has(key)) {
        const fn = getNearestParentFcTag(parent)
        keyWarning(
          `${fn} component produced a child in a list with a duplicate key prop: "${key}". Keys should be unique so that components maintain their identity across updates`
        )
        warned = true
      }
      keys.add(key)
    }
  }
}

function checkForMissingKeys(parent: VNode, children: unknown[]) {
  let hasKey = false
  let hasMissingKey = false
  for (const child of children) {
    if (!isElement(child)) continue
    if (typeof child.key === "string") {
      hasKey = true
    } else {
      hasMissingKey = true
    }
  }
  if (hasMissingKey && hasKey) {
    const fn = getNearestParentFcTag(parent)
    keyWarning(
      `${fn} component produced a child in a list without a valid key prop`
    )
  }
}

function keyWarning(str: string) {
  const formatted = `[kiru]: ${str}. See https://kirujs.dev/keys-warning for more information.`
  console.error(formatted)
}

const parentFcTagLookups = new WeakMap<VNode, string>()
function getNearestParentFcTag(vNode: VNode) {
  if (parentFcTagLookups.has(vNode)) {
    return parentFcTagLookups.get(vNode)
  }
  let p: VNode | null = vNode.parent
  let fn: (Function & { displayName?: string }) | undefined
  while (!fn && p) {
    if (typeof p.type === "function") fn = p.type
    p = p.parent
  }
  const tag = `<${fn?.displayName || fn?.name || "Anonymous Function"} />`
  parentFcTagLookups.set(vNode, tag)
  return tag
}

function createVNode(
  parent: VNode,
  type: VNode["type"],
  props: VNode["props"],
  key: VNode["key"] = null,
  index = 0
): VNode {
  const node = createBaseVNode(type, parent, props, key, index)
  node.flags |= FLAG_PLACEMENT

  if (typeof type === "function" && isMemoFn(type)) {
    node.flags |= FLAG_MEMO
  }

  if (__DEV__ && "window" in globalThis) {
    window.__kiru.profilingContext?.emit("createNode", appCtx)
  }
  return node
}
