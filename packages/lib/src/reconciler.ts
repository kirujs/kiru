import {
  $FRAGMENT,
  $INLINE_FN,
  FLAG_PLACEMENT,
  FLAG_STATIC_CHILDREN,
  FLAG_TEMPLATE_HOLES_SYNCED,
  FLAG_HOISTED,
  FLAG_TEMPLATE,
  FLAG_UPDATE,
  $STATIC_CHILDREN_LIST,
  svgTags,
} from "./constants.js"
import {
  dynamicSlotsFromRegions,
  regionAt,
  slotRegionAt,
  type CompileRegion,
} from "./compileRegions.js"
import { runAnchorRegionOp, runSlotRegionOp } from "./regionOps.js"
import { hydrateDom } from "./dom/nodes.js"
import {
  cloneTemplateDom,
  resolveTemplateHoleAnchors,
  isTemplateRoot,
  type TemplateRoot,
} from "./template.js"
import {
  getVNodeApp,
  isElement,
  isValidTextChild,
  latest,
  propsChanged,
} from "./utils/index.js"
import { isSignal, type Signal } from "./signals/base.js"
import { __DEV__, isBrowser } from "./env.js"
import { hydrationStack } from "./hydration.js"
import { renderMode } from "./globals.js"
import type { AppHandle } from "./appHandle.js"
import { createVNode as createBaseVNode } from "./vNode.js"

type VNode = Kiru.VNode
type KElement = Kiru.Element
let app: AppHandle

export function reconcileChildren(
  parent: VNode,
  children: unknown
): VNode | null {
  if (__DEV__) {
    app = getVNodeApp(parent)!
  }
  if (Array.isArray(children)) {
    if (__DEV__) {
      // array children are 'tagged' during parent reconciliation pass
      if ($LIST_CHILD in children) {
        checkForMissingKeys(parent, children)
      }
      checkForDuplicateKeys(parent, children)
    }
    if (parent.flags & FLAG_STATIC_CHILDREN) {
      return patchStaticChildren(parent, children)
    }
    return patchDynamicChildren(parent, children)
  }
  return patchSingleChild(parent, children)
}

function patchSingleChild(parent: VNode, child: unknown): VNode | null {
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
      placeChild(parent, newNode, 0, 0)
    }
    existingChildren.forEach((child) => deleteChild(parent, child))
    return newNode
  }
}

export function tryReconcileStaticChildrenInPlace(
  parent: VNode,
  children: unknown[]
): VNode | null | undefined {
  let old = parent.child
  let i = 0
  while (old !== null && i < children.length) {
    const next = old.sibling
    const updated = updateSlot(parent, old, children[i])
    if (updated === null || updated !== old) {
      return undefined
    }
    old = next
    i++
  }
  if (i === children.length && old === null) {
    return parent.child
  }
  return undefined
}

function assertStaticChildrenContract(parent: VNode, children: unknown[]) {
  if (!__DEV__) return
  if (!($STATIC_CHILDREN_LIST in children)) {
    console.warn(
      "[kiru]: reconciling FLAG_STATIC_CHILDREN without a compiler-tagged children array"
    )
  }
  const prev = parent.staticChildCount
  if (prev !== undefined && prev !== children.length) {
    console.warn(
      `[kiru]: static children length changed from ${prev} to ${children.length}`
    )
  }
  parent.staticChildCount = children.length
}

function patchStaticChildren(parent: VNode, children: unknown[]) {
  assertStaticChildrenContract(parent, children)

  const regions = parent.slotRegions
  if (regions !== undefined && regions.length > 0) {
    const dynamicSlots = dynamicSlotsFromRegions(regions)
    if (dynamicSlots.length > 0) {
      return patchStaticChildrenMasked(parent, children, dynamicSlots, regions)
    }
  }

  if (parent.child !== null) {
    const inPlace = tryReconcileStaticChildrenInPlace(parent, children)
    if (inPlace !== undefined) {
      return inPlace
    }
  }

  let resultingChild: VNode | null = null
  let prevNewChild: VNode | null = null

  let oldChild = parent.child
  let lastPlacedIndex = 0
  let newIdx = 0

  for (; oldChild !== null && newIdx < children.length; newIdx++) {
    const nextOldChild = oldChild.sibling
    const newChild = updateSlot(parent, oldChild, children[newIdx])
    if (newChild === null) {
      return patchDynamicChildren(parent, children)
    }
    if (!newChild.prev) {
      deleteChild(parent, oldChild)
    }
    lastPlacedIndex = placeChild(parent, newChild, lastPlacedIndex, newIdx)
    if (prevNewChild === null) {
      resultingChild = newChild
    } else {
      prevNewChild.sibling = newChild
    }
    prevNewChild = newChild
    oldChild = nextOldChild
  }

  if (newIdx === children.length) {
    deleteRemainingChildren(parent, oldChild)
    return resultingChild
  }

  for (; newIdx < children.length; newIdx++) {
    const newNode = createChild(parent, children[newIdx])
    if (newNode === null) continue
    lastPlacedIndex = placeChild(parent, newNode, lastPlacedIndex, newIdx)
    if (prevNewChild === null) {
      resultingChild = newNode
    } else {
      prevNewChild.sibling = newNode
    }
    prevNewChild = newNode
  }
  return resultingChild
}

const updateDynamicSlot = (
  parent: VNode,
  oldChild: VNode | null,
  child: unknown,
  slotIndex: number,
  regions?: readonly CompileRegion[]
): VNode | null => {
  const region =
    slotRegionAt(regions, slotIndex) ?? regionAt(regions, slotIndex, "slot")
  return runSlotRegionOp(region, {
    parent,
    oldChild,
    child,
    updateSlot,
    patchDynamicChildren,
  })
}

function patchStaticChildrenMasked(
  parent: VNode,
  children: unknown[],
  dynamicSlots: readonly number[],
  regions?: readonly CompileRegion[]
) {
  const dynamicSet = new Set(dynamicSlots)

  if (parent.child !== null) {
    let canShortCircuit = true
    for (let i = 0; i < children.length; i++) {
      if (dynamicSet.has(i)) continue
      const old = staticChildAt(parent, i)
      if (!old) {
        canShortCircuit = false
        break
      }
      const updated = updateSlot(parent, old, children[i])
      if (updated === null || updated !== old) {
        canShortCircuit = false
        break
      }
    }
    if (canShortCircuit) {
      let old: VNode | null = parent.child
      let i = 0
      while (old !== null && i < children.length) {
        if (dynamicSet.has(i)) {
          const updated = updateDynamicSlot(
            parent,
            old,
            children[i],
            i,
            regions
          )
          if (updated === null || updated !== old) {
            return patchDynamicChildren(parent, children)
          }
        }
        old = old.sibling
        i++
      }
      if (i === children.length && old === null) {
        return parent.child
      }
    }
  }

  let resultingChild: VNode | null = null
  let prevNewChild: VNode | null = null
  let oldChild = parent.child
  let lastPlacedIndex = 0

  for (let newIdx = 0; newIdx < children.length; newIdx++) {
    const nextOldChild = oldChild?.sibling ?? null
    const isDynamic = dynamicSet.has(newIdx)

    if (!isDynamic && oldChild !== null) {
      const updated = updateSlot(parent, oldChild, children[newIdx])
      if (updated === null) {
        return patchDynamicChildren(parent, children)
      }
      if (updated === oldChild) {
        lastPlacedIndex = placeChild(parent, updated, lastPlacedIndex, newIdx)
        if (prevNewChild === null) {
          resultingChild = updated
        } else {
          prevNewChild.sibling = updated
        }
        prevNewChild = updated
        oldChild = nextOldChild
        continue
      }
    }

    const newChild = isDynamic
      ? updateDynamicSlot(parent, oldChild, children[newIdx], newIdx, regions)
      : updateSlot(parent, oldChild, children[newIdx])
    if (newChild === null) {
      return patchDynamicChildren(parent, children)
    }
    if (oldChild && !newChild.prev) {
      deleteChild(parent, oldChild)
    }
    lastPlacedIndex = placeChild(parent, newChild, lastPlacedIndex, newIdx)
    if (prevNewChild === null) {
      resultingChild = newChild
    } else {
      prevNewChild.sibling = newChild
    }
    prevNewChild = newChild
    oldChild = nextOldChild
  }

  deleteRemainingChildren(parent, oldChild)
  return resultingChild
}

function staticChildAt(parent: VNode, index: number): VNode | null {
  let child = parent.child
  for (let i = 0; i < index && child; i++) {
    child = child.sibling
  }
  return child
}

function patchDynamicChildren(parent: VNode, children: unknown[]) {
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
    lastPlacedIndex = placeChild(parent, newChild, lastPlacedIndex, newIdx)
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
      lastPlacedIndex = placeChild(parent, newNode, lastPlacedIndex, newIdx)
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
      lastPlacedIndex = placeChild(parent, newNode, lastPlacedIndex, newIdx)
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
    if (oldChild?.type === "#text" && isSignal(oldChild.props.nodeValue)) {
      return null
    }
    return updateTextNode(parent, oldChild, "" + child)
  }
  if (isSignal(child)) {
    if (!!oldChild && oldChild.props.nodeValue !== child) return null
    return updateTextNode(parent, oldChild, child)
  }
  if (isTemplateRoot(child)) {
    if (key !== null) return null
    if (
      oldChild !== null &&
      (oldChild.flags & FLAG_TEMPLATE) !== 0 &&
      oldChild.templateHtml === child.html
    ) {
      refreshReusedTemplateHoles(oldChild, child)
      return oldChild
    }
    return createTemplateVNode(parent, child)
  }
  if (isElement(child)) {
    const staticUnkeyed =
      parent.flags & FLAG_STATIC_CHILDREN && child.key == null && key == null
    if (!staticUnkeyed && child.key !== key) return null
    return updateNode(parent, oldChild, child)
  }
  if (Array.isArray(child)) {
    if (key !== null) return null
    if (__DEV__) {
      markListChild(child)
    }
    return updateFragment(parent, oldChild, child)
  }
  if (typeof child === "function") {
    if (key !== null) return null
    return updateInlineFnChild(parent, oldChild, child)
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
  if (!(parent.flags & FLAG_STATIC_CHILDREN)) {
    oldChild.sibling = null
  }
  return oldChild
}

function updateNode(parent: VNode, oldChild: VNode | null, newChild: KElement) {
  let { type, props } = newChild
  if (__DEV__ && typeof type === "function") {
    type = latest(type)
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
    if (!(parent.flags & FLAG_STATIC_CHILDREN)) {
      oldChild.sibling = null
    }
    if (typeof type === "string") {
      if (domNodePropsChanged(oldChild.props, props)) {
        oldChild.flags |= FLAG_UPDATE
      }
    } else if (
      !(parent.flags & FLAG_STATIC_CHILDREN) ||
      propsChanged(oldChild.props, props)
    ) {
      oldChild.flags |= FLAG_UPDATE
    }
    oldChild.props = props
    applyElementFlags(oldChild, newChild)
    return oldChild
  }
  return createVNodeFromElement(parent, newChild)
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
  if (!(parent.flags & FLAG_STATIC_CHILDREN)) {
    oldChild.sibling = null
  }
  return oldChild
}

function updateInlineFnChild(
  parent: VNode,
  oldChild: VNode | null,
  expr: Function
) {
  if (oldChild === null || oldChild.type !== $INLINE_FN) {
    return createVNode(parent, $INLINE_FN, { expr })
  }
  if (__DEV__) {
    dev_emitUpdateNode()
  }
  oldChild.props = { expr }
  oldChild.flags |= FLAG_UPDATE
  if (!(parent.flags & FLAG_STATIC_CHILDREN)) {
    oldChild.sibling = null
  }
  return oldChild
}

function createChild(parent: VNode, child: unknown): VNode | null {
  if (isValidTextChild(child)) {
    return createVNode(parent, "#text", { nodeValue: "" + child })
  }

  if (isSignal(child)) {
    return createVNode(parent, "#text", { nodeValue: child })
  }

  if (isTemplateRoot(child)) {
    return createTemplateVNode(parent, child)
  }

  if (isElement(child)) {
    return createVNodeFromElement(parent, child)
  }

  if (Array.isArray(child)) {
    if (__DEV__) {
      markListChild(child)
    }
    return createVNode(parent, $FRAGMENT, { children: child })
  }

  if (typeof child === "function") {
    return createVNode(parent, $INLINE_FN, { expr: child })
  }

  return null
}

function placeChild(
  parent: VNode,
  child: VNode,
  lastPlacedIndex: number,
  newIndex: number
): number {
  const prev = child.prev
  if (
    parent.flags & FLAG_STATIC_CHILDREN &&
    prev !== null &&
    prev.index === newIndex
  ) {
    const oldIndex = prev.index
    return oldIndex < lastPlacedIndex ? lastPlacedIndex : oldIndex
  }

  child.index = newIndex
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
  const isSig = isSignal(child)
  if (isSig || isValidTextChild(child)) {
    const oldChild = existingChildren.get(index)
    if (oldChild?.type === "#text") {
      if (oldChild.props.nodeValue === child) {
        return oldChild
      }
      if (isSignal(oldChild.props.nodeValue)) {
        oldChild.cleanups?.["nodeValue"]?.()
      }
    }

    return createVNode(parent, "#text", { nodeValue: child }, null, index)
  }

  if (isTemplateRoot(child)) {
    const oldChild = existingChildren.get(index)
    if (
      oldChild &&
      (oldChild.flags & FLAG_TEMPLATE) !== 0 &&
      oldChild.templateHtml === child.html
    ) {
      refreshReusedTemplateHoles(oldChild, child)
      oldChild.sibling = null
      oldChild.index = index
      return oldChild
    }
    return createTemplateVNode(parent, child)
  }

  if (isElement(child)) {
    const { type, props, key } = child
    const oldChild = existingChildren.get(key === null ? index : key)
    if (oldChild?.type === type) {
      if (__DEV__) {
        dev_emitUpdateNode()
      }
      if (typeof type === "string") {
        if (domNodePropsChanged(oldChild.props, props)) {
          oldChild.flags |= FLAG_UPDATE
        }
      } else {
        oldChild.flags |= FLAG_UPDATE
      }
      oldChild.props = props
      oldChild.sibling = null
      oldChild.index = index
      applyElementFlags(oldChild, child)
      return oldChild
    }

    return createVNodeFromElement(parent, child, index)
  }

  if (Array.isArray(child)) {
    const props = { children: child }
    if (__DEV__) {
      markListChild(child)
    }
    const oldChild = existingChildren.get(index)
    if (oldChild?.type === $FRAGMENT) {
      if (__DEV__) {
        dev_emitUpdateNode()
      }
      oldChild.flags |= FLAG_UPDATE
      oldChild.props = props
      return oldChild
    }

    return createVNode(parent, $FRAGMENT, props, null, index)
  }

  if (typeof child === "function") {
    const props = { expr: child }
    const oldChild = existingChildren.get(index)
    if (oldChild?.type === $INLINE_FN) {
      if (__DEV__) {
        dev_emitUpdateNode()
      }
      oldChild.flags |= FLAG_UPDATE
      oldChild.props = props
      return oldChild
    }

    return createVNode(parent, $INLINE_FN, props, null, index)
  }

  return null
}

function dev_emitUpdateNode() {
  if (!isBrowser) return
  window.__kiru.profilingContext?.emit("updateNode", app)
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

function applyElementFlags(node: VNode, element: KElement) {
  const compileFlags = element.meta?.flags ?? 0
  if (compileFlags & FLAG_STATIC_CHILDREN) {
    node.flags |= FLAG_STATIC_CHILDREN
  } else {
    node.flags &= ~FLAG_STATIC_CHILDREN
  }
  if (compileFlags & FLAG_HOISTED) {
    node.flags |= FLAG_HOISTED
  } else {
    node.flags &= ~FLAG_HOISTED
  }
  const regions = element.meta?.regions
  if (regions !== undefined) {
    node.slotRegions = regions
  }
}

/** Sync hole children from a new `createHoledTemplate` value and reconcile mounted holes. */
function refreshReusedTemplateHoles(
  vNode: VNode,
  template: TemplateRoot
): void {
  const count = template.holeCount ?? 0
  vNode.templateHoleCount = count
  if (template.holeChildren !== undefined) {
    vNode.templateHoleChildren = template.holeChildren
  }
  if (template.regions !== undefined) {
    vNode.templateRegions = template.regions
  }
  if (count > 0 && vNode.dom) {
    reconcileTemplateHoles(vNode)
    // Holes are already reconciled; mark so performUnitOfWork descends into hole
    // heads without a second reconcileTemplateHoles (avoids duplicate work and
    // re-weaving holes before stale cross-hole sibling links are cleared).
    vNode.flags |= FLAG_TEMPLATE_HOLES_SYNCED
  }
}

/** Remove a stale weave from the previous hole's tail into `toHead`. */
function unlinkTemplateHoleWeave(
  fromHead: VNode | null,
  toHead: VNode | null
): void {
  if (!fromHead || !toHead) return
  let node: VNode = fromHead
  while (node.sibling) {
    if (node.sibling === toHead) {
      node.sibling = null
      return
    }
    node = node.sibling
  }
}

function nextStoredHoleHead(
  heads: (VNode | null)[] | undefined,
  fromIndex: number
): VNode | null {
  if (!heads) return null
  for (let i = fromIndex + 1; i < heads.length; i++) {
    const head = heads[i]
    if (head) return head
  }
  return null
}

function prevStoredHoleHead(
  heads: (VNode | null)[] | undefined,
  fromIndex: number
): VNode | null {
  if (!heads) return null
  for (let i = fromIndex - 1; i >= 0; i--) {
    const head = heads[i]
    if (head) return head
  }
  return null
}

/** Ephemeral hole slot parents are not walked by the scheduler; bubble to the template host. */
function adoptTemplateHoleDeletions(template: VNode, slotParent: VNode): void {
  const pending = slotParent.deletions
  if (!pending?.length) return
  if (template.deletions) {
    template.deletions.push(...pending)
  } else {
    template.deletions = pending
  }
  slotParent.deletions = null
}

/** Last vnode belonging to a single hole (does not follow weaves into the next hole). */
function templateHoleTail(
  head: VNode,
  nextHoleHead: VNode | null | undefined
): VNode {
  let tail = head
  while (tail.sibling) {
    if (nextHoleHead && tail.sibling === nextHoleHead) {
      tail.sibling = null
      break
    }
    tail = tail.sibling
  }
  return tail
}

function reconcileTemplateHoleContent(
  slotParent: VNode,
  holeChild: unknown,
  region: CompileRegion,
  existing: VNode | null
): VNode | null {
  return runAnchorRegionOp(region, {
    slotParent,
    holeChild,
    existing,
    prepareExisting: () => {
      if (existing) slotParent.child = existing
    },
    reconcileChildren,
    updateSlot,
  })
}

function hydrateVNodeChain(head: VNode | null): void {
  let node = head
  while (node) {
    hydrateVNode(node)
    node = node.sibling
  }
}

function hydrateVNode(vNode: VNode): void {
  if (typeof vNode.type === "string") {
    if (!vNode.dom) {
      hydrateDom(vNode)
    }
    if (vNode.type === "#text") return
    if (vNode.flags & FLAG_TEMPLATE) {
      if ((vNode.templateHoleCount ?? 0) > 0) {
        reconcileTemplateHoles(vNode)
      }
      return
    }
    if (vNode.child && vNode.dom) {
      hydrationStack.push(
        vNode.dom as unknown as import("./types.utils.js").SomeDom
      )
      hydrateVNodeChain(vNode.child)
      hydrationStack.pop()
    }
    return
  }
  if (vNode.child) {
    hydrateVNodeChain(vNode.child)
  }
}

export function reconcileTemplateHoles(vNode: VNode): VNode | null {
  const root = vNode.dom
  if (!(root instanceof Element)) return null
  const holeCount = vNode.templateHoleCount ?? 0
  if (holeCount === 0) return vNode.child

  const holeChildren = vNode.templateHoleChildren ?? []
  const anchors = resolveTemplateHoleAnchors(
    root,
    holeCount,
    vNode.templateHoleAnchors
  )
  if (!vNode.templateHoleAnchors) {
    vNode.templateHoleAnchors = anchors
  }

  let first: VNode | null = null
  let prevTail: VNode | null = null

  for (let i = 0; i < holeCount; i++) {
    const anchor = anchors[i]!
    const parentEl = anchor.parentNode as Element | null
    if (!parentEl) continue

    const nextStoredHead = nextStoredHoleHead(vNode.templateHoleHeads, i)
    const prevStoredHead = prevStoredHoleHead(vNode.templateHoleHeads, i)
    if (prevStoredHead) {
      unlinkTemplateHoleWeave(prevStoredHead, vNode.templateHoleHeads?.[i] ?? null)
    }

    const slotParent = createVNode(vNode, $FRAGMENT, {})
    slotParent.dom = parentEl as Kiru.VNode["dom"]
    slotParent.templateHoleAnchor = anchor

    const holeChild = holeChildren[i]
    const region = regionAt(vNode.templateRegions, i, "template")
    if (
      region.kind === "fragment" ||
      (Array.isArray(holeChild) &&
        $STATIC_CHILDREN_LIST in (holeChild as object))
    ) {
      slotParent.flags |= FLAG_STATIC_CHILDREN
    }

    const existing = vNode.templateHoleHeads?.[i] ?? null
    if (existing) {
      unlinkTemplateHoleWeave(existing, nextStoredHead)
    }
    const hydrating = renderMode.current === "hydrate"
    if (hydrating) {
      const nodeIndex = [...parentEl.childNodes].indexOf(anchor)
      if (nodeIndex >= 0) {
        hydrationStack.push(
          parentEl as unknown as import("./types.utils.js").SomeDom
        )
        hydrationStack.setChildIndex(nodeIndex + 1)
      }
    }
    const head = reconcileTemplateHoleContent(
      slotParent,
      holeChild,
      region,
      existing
    )
    adoptTemplateHoleDeletions(vNode, slotParent)
    if (hydrating && head) {
      hydrateVNodeChain(head)
    }
    if (hydrating) {
      hydrationStack.pop()
    }

    if (head && !existing) {
      let n: VNode | null = head
      while (n) {
        if (n.dom) {
          parentEl.insertBefore(n.dom, anchor)
        }
        n = n.sibling
      }
    }

    if (!vNode.templateHoleHeads) {
      vNode.templateHoleHeads = []
    }
    vNode.templateHoleHeads[i] = head

    if (!first) first = head
    else if (prevTail && head) {
      if (__DEV__ && prevTail === head) {
        throw new Error(
          "[kiru]: template hole weave would create a self-sibling cycle"
        )
      }
      prevTail.sibling = head
    }
    if (head) {
      prevTail = templateHoleTail(head, nextStoredHead)
    }
  }

  vNode.child = first
  return first
}

function createTemplateVNode(parent: VNode, template: TemplateRoot): VNode {
  const holeCount = template.holeCount ?? 0
  let type: VNode["type"] = "div"
  if (renderMode.current !== "hydrate" && typeof document !== "undefined") {
    const dom = cloneTemplateDom(template.html)
    const tagName = dom.tagName.toLowerCase()
    type = (svgTags.has(tagName) ? dom.tagName : tagName) as VNode["type"]
    const node = createVNode(parent, type, {})
    node.flags |= FLAG_TEMPLATE
    node.templateHtml = template.html
    node.templateHoleCount = holeCount
    if (holeCount > 0 && template.holeChildren) {
      node.templateHoleChildren = template.holeChildren
    }
    if (template.regions) {
      node.templateRegions = template.regions
    }
    node.dom = dom as Kiru.VNode["dom"]
    if (holeCount > 0) {
      node.templateHoleAnchors = resolveTemplateHoleAnchors(
        dom as Element,
        holeCount
      )
    }
    if (__DEV__) {
      ;(dom as Element).__kiruNode = node
    }
    return node
  }
  type = inferTemplateRootType(template.html)
  const node = createVNode(parent, type, {})
  node.flags |= FLAG_TEMPLATE
  node.templateHtml = template.html
  node.templateHoleCount = holeCount
  if (holeCount > 0 && template.holeChildren) {
    node.templateHoleChildren = template.holeChildren
  }
  if (template.regions) {
    node.templateRegions = template.regions
  }
  return node
}

function inferTemplateRootType(html: string): VNode["type"] {
  const m = /^<([a-zA-Z][\w-]*)/.exec(html.trim())
  if (!m) return "div"
  const tag = m[1]!
  return svgTags.has(tag)
    ? (tag as VNode["type"])
    : (tag.toLowerCase() as VNode["type"])
}

function createVNodeFromElement(
  parent: VNode,
  element: KElement,
  index = 0
): VNode {
  let { type, props, key } = element
  if (__DEV__ && typeof type === "function") {
    type = latest(type)
  }
  const node = createVNode(parent, type, props, key, index)
  applyElementFlags(node, element)
  return node
}

function createVNode(
  parent: VNode,
  type: VNode["type"],
  props?: VNode["props"],
  key: VNode["key"] = null,
  index = 0
): VNode {
  const node = createBaseVNode(type, parent, props, key, index)
  node.flags |= FLAG_PLACEMENT

  if (__DEV__ && isBrowser) {
    window.__kiru.profilingContext?.emit("createNode", app)
  }
  return node
}

const IGNORED_DOM_NODE_PROPS = ["children", "key"]
function domNodePropsChanged(
  oldProps: Kiru.VNode["props"],
  newProps: Kiru.VNode["props"]
) {
  return propsChanged(oldProps, newProps, IGNORED_DOM_NODE_PROPS)
}
