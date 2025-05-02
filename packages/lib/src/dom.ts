import {
  traverseApply,
  booleanAttributes,
  commitSnapshot,
  propFilters,
  propToHtmlAttr,
  svgTags,
  postOrderApply,
  classNamePropToString,
} from "./utils.js"
import { cleanupHook } from "./hooks/utils.js"
import { ELEMENT_TYPE, FLAG } from "./constants.js"
import { Signal, unwrap } from "./signals/index.js"
import { renderMode } from "./globals.js"
import { hydrationStack } from "./hydration.js"
import { StyleObject } from "./types.dom.js"
import { isPortal } from "./portal.js"
import { __DEV__ } from "./env.js"
import { KaiokenError } from "./error.js"
import { flags } from "./flags.js"
import type {
  DomVNode,
  ElementVNode,
  MaybeDom,
  SomeDom,
  SomeElement,
} from "./types.utils"

export { commitWork, createDom, updateDom, hydrateDom }

type VNode = Kaioken.VNode
type HostNode = {
  node: ElementVNode
  lastChild?: DomVNode
}
type PlacementScope = {
  parent: VNode
  active: boolean
  child?: VNode
}

function setDomRef(ref: Kaioken.Ref<SomeDom | null>, value: SomeDom | null) {
  if (typeof ref === "function") {
    ref(value)
    return
  }
  if (Signal.isSignal(ref)) {
    ref.sneak(value)
    ref.notify({
      filter: (sub) => typeof sub === "function",
    })
    return
  }
  ;(ref as Kaioken.MutableRefObject<SomeDom | null>).current = value
}

function createDom(vNode: VNode): SomeDom {
  const t = vNode.type as string
  const dom =
    t == ELEMENT_TYPE.text
      ? createTextNode(vNode)
      : svgTags.includes(t)
      ? document.createElementNS("http://www.w3.org/2000/svg", t)
      : document.createElement(t)
  //setDomRef(vNode, dom)
  return dom
}
function createTextNode(vNode: VNode): Text {
  const prop = vNode.props.nodeValue
  const value = unwrap(prop)
  const textNode = document.createTextNode(value)
  if (Signal.isSignal(prop)) {
    subTextNode(vNode, textNode, prop)
  }
  return textNode
}

/**
 * toggled when we fire a focus event on an element
 * persist focus when the currently focused element is moved.
 */
let persistingFocus = false

// gets set prior to dom commits
let currentActiveElement: Element | null = null

let didBlurActiveElement = false
const placementBlurHandler = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  didBlurActiveElement = true
}

function handlePrePlacementFocusPersistence() {
  persistingFocus = true
  currentActiveElement = document.activeElement
  if (currentActiveElement && currentActiveElement !== document.body) {
    currentActiveElement.addEventListener("blur", placementBlurHandler)
  }
}

function handlePostPlacementFocusPersistence() {
  if (!didBlurActiveElement) {
    persistingFocus = false
    return
  }
  currentActiveElement?.removeEventListener("blur", placementBlurHandler)
  if (currentActiveElement?.isConnected) {
    if ("focus" in currentActiveElement) (currentActiveElement as any).focus()
  }
  persistingFocus = false
}

function wrapFocusEventHandler(callback: (event: FocusEvent) => void) {
  return (event: FocusEvent) => {
    if (persistingFocus) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    callback(event)
  }
}

type WrappedFocusEventMap = {
  onfocus?: (event: FocusEvent) => void
  onblur?: (event: FocusEvent) => void
}

const vNodeToWrappedFocusEventHandlersMap = new WeakMap<
  VNode,
  WrappedFocusEventMap
>()

function updateDom(vNode: VNode) {
  if (isPortal(vNode)) return
  const dom = vNode.dom as SomeDom
  const prevProps: Record<string, any> = vNode.prev?.props ?? {}
  const nextProps: Record<string, any> = vNode.props ?? {}

  const keys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)])

  keys.forEach((key) => {
    if (propFilters.internalProps.includes(key) && key !== "innerHTML") {
      if (key === "ref" && prevProps[key] !== nextProps[key]) {
        if (prevProps[key]) {
          setDomRef(prevProps[key], null)
        }
        if (nextProps[key]) {
          setDomRef(nextProps[key], dom)
        }
      }
      return
    }

    if (propFilters.isEvent(key)) {
      if (
        prevProps[key] !== nextProps[key] ||
        renderMode.current === "hydrate"
      ) {
        const eventType = key.toLowerCase().substring(2)
        if (key in prevProps) {
          let cb = prevProps[key]
          if (key === "onfocus" || key === "onblur") {
            cb = vNodeToWrappedFocusEventHandlersMap.get(vNode)?.[key]
          }
          dom.removeEventListener(eventType, cb)
        }
        if (key in nextProps) {
          let cb = nextProps[key]
          if (key === "onfocus" || key === "onblur") {
            cb = wrapFocusEventHandler(cb)
            const wrappedHandlers =
              vNodeToWrappedFocusEventHandlersMap.get(vNode) ?? {}
            wrappedHandlers[key] = cb
            vNodeToWrappedFocusEventHandlersMap.set(vNode, wrappedHandlers)
          }
          dom.addEventListener(eventType, cb)
        }
      }
      return
    }

    if (!(dom instanceof Text)) {
      if (prevProps[key] === nextProps[key]) return
      if (Signal.isSignal(prevProps[key]) && vNode.cleanups) {
        vNode.cleanups[key] &&
          (vNode.cleanups[key](), delete vNode.cleanups[key])
      }
      if (Signal.isSignal(nextProps[key])) {
        const unsub = nextProps[key].subscribe((value) => {
          setProp(vNode, dom, key, value, null)
        })
        ;(vNode.cleanups ??= {})[key] = unsub
        return setProp(
          vNode,
          dom,
          key,
          nextProps[key].peek(),
          unwrap(prevProps[key])
        )
      }
      setProp(vNode, dom, key, nextProps[key], prevProps[key])
      return
    }
    if (Signal.isSignal(nextProps[key])) {
      // signal textNodes are handled via 'subTextNode'.
      return
    }
    const nodeVal = nextProps[key]
    if (dom.nodeValue !== nodeVal) {
      dom.nodeValue = nodeVal
    }
  })
}

function subTextNode(vNode: VNode, textNode: Text, signal: Signal<string>) {
  ;(vNode.cleanups ??= {})["nodeValue"] = signal.subscribe((v) => {
    textNode.nodeValue = v
  })
}

function hydrateDom(vNode: VNode) {
  const dom = hydrationStack.nextChild()
  if (!dom)
    throw new KaiokenError({
      message: `Hydration mismatch - no node found`,
      vNode,
    })
  let nodeName = dom.nodeName
  if (svgTags.indexOf(nodeName) === -1) {
    nodeName = nodeName.toLowerCase()
  }
  if ((vNode.type as string) !== nodeName) {
    throw new KaiokenError({
      message: `Hydration mismatch - expected node of type ${vNode.type.toString()} but received ${nodeName}`,
      vNode,
    })
  }
  vNode.dom = dom
  if (vNode.type !== ELEMENT_TYPE.text) {
    updateDom(vNode)
    return
  }
  if (Signal.isSignal(vNode.props.nodeValue)) {
    subTextNode(vNode, dom as Text, vNode.props.nodeValue)
  }

  let prev = vNode
  let sibling = vNode.sibling
  while (sibling && sibling.type === ELEMENT_TYPE.text) {
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

function handleAttributeRemoval(
  element: Element,
  key: string,
  value: unknown,
  isBoolAttr = false
) {
  if (value === null) {
    element.removeAttribute(key)
    return true
  }
  switch (typeof value) {
    case "undefined":
    case "function":
    case "symbol": {
      element.removeAttribute(key)
      return true
    }
    case "boolean": {
      if (isBoolAttr && !value) {
        element.removeAttribute(key)
        return true
      }
    }
  }

  return false
}

function setDomAttribute(element: Element, key: string, value: unknown) {
  const isBoolAttr = booleanAttributes.includes(key)

  if (handleAttributeRemoval(element, key, value, isBoolAttr)) return

  element.setAttribute(
    key,
    isBoolAttr && typeof value === "boolean" ? "" : String(value)
  )
}

const explicitValueElementTags = ["INPUT", "TEXTAREA", "SELECT"]

const needsExplicitValueSet = (
  element: SomeElement
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
  return explicitValueElementTags.indexOf(element.nodeName) > -1
}

function setProp(
  vNode: VNode,
  element: SomeElement,
  key: string,
  value: unknown,
  prev: unknown
) {
  if (value === prev) return
  switch (key) {
    case "style":
      return setStyleProp(vNode, element, value, prev)
    case "className":
      return setClassName(element, value)
    case "innerHTML":
      return setInnerHTML(element, value)
    case "muted":
      ;(element as HTMLMediaElement).muted = Boolean(value)
      return
    case "value":
      if (needsExplicitValueSet(element)) {
        element.value =
          value === undefined || value === null ? "" : String(value)
      } else {
        element.setAttribute("value", value === undefined ? "" : String(value))
      }
      return
    case "checked":
      if (element.nodeName === "INPUT") {
        ;(element as HTMLInputElement).checked = Boolean(value)
      } else {
        element.setAttribute("checked", String(value))
      }
      return
    default:
      setDomAttribute(element, propToHtmlAttr(key), value)
      break
  }
}

function setInnerHTML(element: SomeElement, value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") {
    element.innerHTML = ""
    return
  }
  element.innerHTML = String(value)
}

function setClassName(element: SomeElement, value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") {
    element.removeAttribute("class")
    return
  }
  element.setAttribute("class", classNamePropToString(value))
}

function setStyleProp(
  vNode: VNode,
  element: SomeElement,
  value: unknown,
  prev: unknown
) {
  if (typeof value !== typeof prev) {
    if (typeof prev === "object" && prev !== null) {
      delete vNode.prevStyleObj
    } else if (typeof prev === "string") {
      delete vNode.prevStyleStr
    }
  }
  if (handleAttributeRemoval(element, "style", value)) return
  switch (typeof value) {
    case "string":
      if (value === vNode.prevStyleStr) return
      element.setAttribute("style", value)
      vNode.prevStyleStr = value
      break
    case "object":
      const style = vNode.prevStyleObj ?? {}
      Object.entries(value as object).forEach(([k, v]) => {
        if (style[k as keyof typeof style] !== v) {
          style[k as keyof typeof style] = v
          element.style[k as any] = v
        }
      })
      Object.keys(style).forEach((k) => {
        if (!(k in (value as object))) {
          delete style[k as keyof StyleObject]
          element.style[k as any] = ""
        }
      })
      vNode.prevStyleObj = style
      break
    default:
      break
  }
}

function getDomParent(vNode: VNode): ElementVNode {
  let parentNode: VNode | undefined = vNode.parent ?? vNode.prev?.parent
  let parentNodeElement = parentNode?.dom
  while (parentNode && !parentNodeElement) {
    parentNode = parentNode.parent
    parentNodeElement = parentNode?.dom
  }

  if (!parentNodeElement || !parentNode) {
    if (!vNode.parent) {
      // handle app entry
      if (vNode.dom) return vNode as ElementVNode
    }

    throw new KaiokenError({
      message: "No DOM parent found while attempting to place node.",
      vNode: vNode,
    })
  }
  return parentNode as ElementVNode
}

function placeDom(
  vNode: DomVNode,
  mntParent: ElementVNode,
  prevSiblingDom?: SomeDom
) {
  const dom = vNode.dom
  if (prevSiblingDom) {
    prevSiblingDom.after(dom)
    return
  }
  if (mntParent.dom.childNodes.length === 0) {
    mntParent.dom.appendChild(dom)
    return
  }
  /**
   * scan from vNode, up, down, then right (repeating) to find previous dom
   */
  let prevDom: MaybeDom
  let currentParent = vNode.parent!
  let furthestParent = currentParent
  let child = currentParent.child!

  /**
   * to prevent sibling-traversal beyond the mount parent or the node
   * we're placing, we're creating a 'bounds' for our traversal.
   */
  const dBounds: VNode[] = [vNode]
  const rBounds: VNode[] = [vNode]
  let parent = vNode.parent
  while (parent && parent !== mntParent) {
    rBounds.push(parent)
    parent = parent.parent
  }

  const siblingCheckpoints: VNode[] = []
  while (child && currentParent.depth >= mntParent.depth) {
    /**
     * keep track of siblings we've passed for later,
     * as long as they're within bounds.
     */
    if (child.sibling && rBounds.indexOf(child) === -1) {
      siblingCheckpoints.push(child.sibling)
    }
    // downwards traversal
    if (!isPortal(child) && dBounds.indexOf(child) === -1) {
      dBounds.push(child)
      const dom = child.dom
      // traverse downwards if no dom for this child
      if (!dom && child.child) {
        currentParent = child
        child = currentParent.child!
        continue
      }
      // dom found, we can continue up/right traversal
      if (dom?.isConnected) {
        prevDom = dom
      }
    }

    // reverse and traverse through most recent sibling checkpoint
    if (siblingCheckpoints.length) {
      child = siblingCheckpoints.pop()!
      currentParent = child.parent!
      continue
    }

    if (prevDom) break // no need to continue traversal
    if (!furthestParent.parent) break // we've reached the root of the tree

    // continue our upwards crawl from the furthest parent
    currentParent = furthestParent.parent
    furthestParent = currentParent
    child = currentParent.child!
  }

  if (!prevDom) {
    return mntParent.dom.prepend(dom)
  }
  prevDom.after(dom)
}

function commitWork(vNode: VNode) {
  if (renderMode.current === "hydrate") {
    return traverseApply(vNode, commitSnapshot)
  }
  if (flags.get(vNode.flags, FLAG.DELETION)) {
    return commitDeletion(vNode)
  }
  handlePrePlacementFocusPersistence()

  const hostNodes: HostNode[] = []
  let currentHostNode: HostNode | undefined
  const placementScopes: PlacementScope[] = []
  let currentPlacementScope: PlacementScope | undefined

  postOrderApply(vNode, {
    onDescent: (node) => {
      if (!node.child) return
      if (node.dom) {
        // if (node.props["data-test"]) debugger
        // collect host nodes as we go
        currentHostNode = { node: node as ElementVNode }
        hostNodes.push(currentHostNode)

        if (node.prev && "innerHTML" in node.prev.props) {
          /**
           * We need to update innerHTML during descent in cases
           * where we previously set innerHTML on this element but
           * now we provide children. Setting innerHTML _after_
           * appending children will yeet em into the abyss.
           */
          delete node.props.innerHTML
          setInnerHTML(node.dom as SomeElement, "")
          // remove innerHTML from prev to prevent our ascension pass from doing this again
          delete node.prev.props.innerHTML
        }

        if (currentPlacementScope?.active) {
          currentPlacementScope.child = node
          // prevent scope applying to descendants of this element node
          currentPlacementScope.active = false
        }
      } else if (flags.get(node.flags, FLAG.PLACEMENT)) {
        currentPlacementScope = { parent: node, active: true }
        placementScopes.push(currentPlacementScope)
      }
    },
    onAscent: (node) => {
      // if (node.props["data-test"]) debugger
      let inheritsPlacement = false
      if (currentPlacementScope?.child === node) {
        currentPlacementScope.active = true
        inheritsPlacement = true
      }
      if (flags.get(node.flags, FLAG.DELETION)) {
        return commitDeletion(node)
      }
      if (node.dom) {
        commitDom(node as DomVNode, currentHostNode, inheritsPlacement)
      }
      commitSnapshot(node)
    },
    onBeforeAscent(node) {
      if (currentPlacementScope?.parent === node) {
        placementScopes.pop()
        currentPlacementScope = placementScopes[placementScopes.length - 1]
      }
      if (currentHostNode?.node === node.parent) {
        hostNodes.pop()
        currentHostNode = hostNodes[hostNodes.length - 1]
      }
    },
  })

  handlePostPlacementFocusPersistence()
}

function commitDom(
  vNode: DomVNode,
  hostNode: HostNode | undefined,
  inheritsPlacement: boolean
) {
  if (isPortal(vNode)) return
  if (
    inheritsPlacement ||
    !vNode.dom.isConnected ||
    flags.get(vNode.flags, FLAG.PLACEMENT)
  ) {
    const parent = hostNode?.node ?? getDomParent(vNode)
    placeDom(vNode, parent, hostNode?.lastChild?.dom)
  }
  if (!vNode.prev || flags.get(vNode.flags, FLAG.UPDATE)) {
    updateDom(vNode)
  }
  if (hostNode) {
    hostNode.lastChild = vNode
  }
}

function commitDeletion(vNode: VNode) {
  if (vNode === vNode.parent?.child) {
    vNode.parent.child = vNode.sibling
  }
  traverseApply(vNode, (node) => {
    const {
      hooks,
      subs,
      cleanups,
      dom,
      props: { ref },
    } = node
    while (hooks?.length) cleanupHook(hooks.pop()!)
    while (subs?.length) Signal.unsubscribe(node, subs.pop()!)
    if (cleanups) Object.values(cleanups).forEach((c) => c())

    if (dom) {
      if (ref) setDomRef(ref as Kaioken.Ref<SomeDom>, null)
      if (dom.isConnected && !isPortal(node)) dom.remove()
      delete node.dom
    }
  })
}
