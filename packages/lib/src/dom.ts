import {
  traverseApply,
  commitSnapshot,
  propFilters,
  propToHtmlAttr,
  getVNodeAppContext,
} from "./utils/index.js"
import {
  booleanAttributes,
  FLAG_PLACEMENT,
  FLAG_UPDATE,
  FLAG_STATIC_DOM,
  svgTags,
  FLAG_NOOP,
  EVENT_PREFIX_REGEX,
} from "./constants.js"
import { Signal } from "./signals/base.js"
import { unwrap } from "./signals/utils.js"
import { renderMode } from "./globals.js"
import { hydrationStack } from "./hydration.js"
import { StyleObject } from "./types.dom.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"
import type {
  DomVNode,
  ElementVNode,
  MaybeDom,
  SomeDom,
  SomeElement,
} from "./types.utils"
import type { AppContext } from "./appContext.js"

export {
  commitWork,
  onBeforeFlushDomChanges,
  onAfterFlushDomChanges,
  commitDeletion,
  createDom,
  hydrateDom,
}

type VNode = Kiru.VNode
type HostNode = {
  node: ElementVNode
  lastChild?: SomeDom
}

let persistingFocus = false
let didBlurActiveElement = false
const placementBlurHandler = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  didBlurActiveElement = true
}

let currentActiveElement: Element | null = null
function onBeforeFlushDomChanges() {
  persistingFocus = true
  currentActiveElement = document.activeElement
  if (currentActiveElement && currentActiveElement !== document.body) {
    currentActiveElement.addEventListener("blur", placementBlurHandler)
  }
}

function onAfterFlushDomChanges() {
  if (didBlurActiveElement) {
    currentActiveElement!.removeEventListener("blur", placementBlurHandler)
    if (currentActiveElement!.isConnected) {
      ;(currentActiveElement as any).focus()
    }
    didBlurActiveElement = false
  }
  persistingFocus = false
}

function setDomRef(ref: Kiru.Ref<SomeDom | null>, value: SomeDom | null) {
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
  ;(ref as Kiru.MutableRefObject<SomeDom | null>).current = value
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
function createTextNode(vNode: VNode): Text {
  const { nodeValue } = vNode.props
  if (!Signal.isSignal(nodeValue)) {
    return document.createTextNode(nodeValue)
  }

  const value = nodeValue.peek() ?? ""
  const textNode = document.createTextNode(value)
  subTextNode(vNode, textNode, nodeValue)
  return textNode
}

function wrapFocusEventHandler(
  vNode: VNode,
  evtName: "focus" | "blur",
  callback: (event: FocusEvent) => void
) {
  const wrappedHandlers = vNodeToWrappedFocusEventHandlersMap.get(vNode) ?? {}
  const handler = (wrappedHandlers[evtName] = (event: FocusEvent) => {
    if (persistingFocus) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    callback(event)
  })
  vNodeToWrappedFocusEventHandlersMap.set(vNode, wrappedHandlers)
  return handler
}

type WrappedFocusEventMap = {
  focus?: (event: FocusEvent) => void
  blur?: (event: FocusEvent) => void
}

const vNodeToWrappedFocusEventHandlersMap = new WeakMap<
  VNode,
  WrappedFocusEventMap
>()

function updateDom(vNode: VNode) {
  const dom = vNode.dom as SomeDom
  const prevProps: Record<string, any> = vNode.prev?.props ?? {}
  const nextProps: Record<string, any> = vNode.props ?? {}
  const keys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)])
  const isHydration = renderMode.current === "hydrate"

  keys.forEach((key) => {
    const prev = prevProps[key],
      next = nextProps[key]
    if (propFilters.internalProps.includes(key) && key !== "innerHTML") {
      if (key === "ref" && prev !== next) {
        if (prev) {
          setDomRef(prev, null)
        }
        if (next) {
          setDomRef(next, dom)
        }
      }
      return
    }

    if (propFilters.isEvent(key)) {
      if (prev !== next || renderMode.current === "hydrate") {
        const evtName = key.replace(EVENT_PREFIX_REGEX, "")

        const isFocusEvent = evtName === "focus" || evtName === "blur"
        if (key in prevProps) {
          dom.removeEventListener(
            evtName,
            isFocusEvent
              ? vNodeToWrappedFocusEventHandlersMap.get(vNode)?.[evtName]
              : prev
          )
        }
        if (key in nextProps) {
          dom.addEventListener(
            evtName,
            isFocusEvent ? wrapFocusEventHandler(vNode, evtName, next) : next
          )
        }
      }
      return
    }

    if (!(dom instanceof Text)) {
      if (prev === next || (isHydration && dom.getAttribute(key) === next)) {
        return
      }

      if (Signal.isSignal(prev) && vNode.cleanups) {
        const v = vNode.cleanups[key]
        v && (v(), delete vNode.cleanups[key])
      }
      if (Signal.isSignal(next)) {
        return setSignalProp(vNode, dom, key, next, prev)
      }
      setProp(dom, key, next, prev)
      return
    }
    if (Signal.isSignal(next)) {
      // signal textNodes are handled via 'subTextNode'.
      return
    }
    // text node
    if (dom.nodeValue !== next) {
      dom.nodeValue = next
    }
  })
}

function deriveSelectElementValue(dom: HTMLSelectElement) {
  if (dom.multiple) {
    return Array.from(dom.selectedOptions).map((option) => option.value)
  }
  return dom.value
}

function setSelectElementValue(dom: HTMLSelectElement, value: any) {
  if (!dom.multiple || value === undefined || value === null || value === "") {
    dom.value = value
    return
  }
  Array.from(dom.options).forEach((option) => {
    option.selected = value.indexOf(option.value) > -1
  })
}

const bindAttrToEventMap: Record<string, string> = {
  value: "input",
  checked: "change",
  open: "toggle",
  volume: "volumechange",
  playbackRate: "ratechange",
  currentTime: "timeupdate",
}
const numericValueElements = ["progress", "meter", "number", "range"]

function setSignalProp(
  vNode: VNode,
  dom: Exclude<SomeDom, Text>,
  key: string,
  signal: Signal<any>,
  prevValue: unknown
) {
  const cleanups = (vNode.cleanups ??= {})
  const [modifier, attr] = key.split(":")
  if (modifier !== "bind") {
    cleanups[key] = signal.subscribe((value, prev) => {
      setProp(dom, key, value, prev)
      if (__DEV__) {
        window.__kiru.profilingContext?.emit(
          "signalAttrUpdate",
          getVNodeAppContext(vNode)!
        )
      }
    })

    return setProp(dom, key, signal.peek(), unwrap(prevValue))
  }

  const evtName = bindAttrToEventMap[attr]
  if (!evtName) {
    if (__DEV__) {
      console.error(`[kiru]: ${attr} is not a valid element binding attribute.`)
    }
    return
  }

  const isSelect = dom instanceof HTMLSelectElement
  const setAttr = isSelect
    ? (value: any) => setSelectElementValue(dom, value)
    : (value: any) => ((dom as any)[attr] = value)

  const signalUpdateCallback = (value: any) => {
    setAttr(value)
    if (__DEV__) {
      window.__kiru.profilingContext?.emit(
        "signalAttrUpdate",
        getVNodeAppContext(vNode)!
      )
    }
  }

  const setSigFromElement = (val: any) => {
    signal.sneak(val)
    signal.notify({ filter: (sub) => sub !== signalUpdateCallback })
  }

  let evtHandler: (evt: Event) => void
  if (attr === "value") {
    const useNumericValue =
      numericValueElements.indexOf((dom as HTMLInputElement).type) !== -1
    evtHandler = () => {
      let val: any = (dom as HTMLInputElement | HTMLSelectElement).value
      if (isSelect) {
        val = deriveSelectElementValue(dom)
      } else if (typeof signal.peek() === "number" && useNumericValue) {
        val = (dom as HTMLInputElement).valueAsNumber
      }
      setSigFromElement(val)
    }
  } else {
    evtHandler = (e: Event) => {
      const val = (e.target as any)[attr]
      /**
       * the 'timeupdate' event is fired when the currentTime property is
       * set (from code OR playback), so we need to prevent unnecessary
       * signal updates to avoid a feedback loop when there are multiple
       * elements with the same signal bound to 'currentTime'
       */
      if (attr === "currentTime" && signal.peek() === val) return
      setSigFromElement(val)
    }
  }

  dom.addEventListener(evtName, evtHandler)
  const unsub = signal.subscribe(signalUpdateCallback)

  cleanups[key] = () => {
    dom.removeEventListener(evtName, evtHandler)
    unsub()
  }

  return setProp(dom, attr, signal.peek(), unwrap(prevValue))
}

function subTextNode(vNode: VNode, textNode: Text, signal: Signal<string>) {
  ;(vNode.cleanups ??= {}).nodeValue = signal.subscribe((value, prev) => {
    if (value === prev) return
    textNode.nodeValue = value
    if (__DEV__) {
      window.__kiru.profilingContext?.emit(
        "signalTextUpdate",
        getVNodeAppContext(vNode)!
      )
    }
  })
}

function tryHydrateNullableSignalChild(vNode: VNode): MaybeDom {
  if (vNode.type !== "#text" || !Signal.isSignal(vNode.props.nodeValue)) {
    return
  }
  const value = unwrap(vNode.props.nodeValue)
  if (value !== null && value !== undefined) {
    return
  }
  const dom = createTextNode(vNode)
  hydrationStack.parent().appendChild(dom)
  return dom
}

function hydrateDom(vNode: VNode) {
  const dom = hydrationStack.nextChild() ?? tryHydrateNullableSignalChild(vNode)

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
    updateDom(vNode)
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
  const isBoolAttr = booleanAttributes.has(key)

  if (handleAttributeRemoval(element, key, value, isBoolAttr)) return

  element.setAttribute(
    key,
    isBoolAttr && typeof value === "boolean" ? "" : String(value)
  )
}

const explicitValueElementTags = ["INPUT", "TEXTAREA"]

const needsExplicitValueSet = (
  element: SomeElement
): element is HTMLInputElement | HTMLTextAreaElement => {
  return explicitValueElementTags.indexOf(element.nodeName) > -1
}

function setProp(
  element: SomeElement,
  key: string,
  value: unknown,
  prev: unknown
) {
  if (value === prev) return
  switch (key) {
    case "style":
      return setStyleProp(element, value, prev)
    case "className":
      return setClassName(element, value)
    case "innerHTML":
      return setInnerHTML(element, value)
    case "muted":
      ;(element as HTMLMediaElement).muted = Boolean(value)
      return
    case "value":
      if (element.nodeName === "SELECT") {
        return setSelectElementValue(element as HTMLSelectElement, value)
      }
      const strVal = value === undefined || value === null ? "" : String(value)
      if (needsExplicitValueSet(element)) {
        element.value = strVal
        return
      }
      element.setAttribute("value", strVal)
      return
    case "checked":
      if (element.nodeName === "INPUT") {
        ;(element as HTMLInputElement).checked = Boolean(value)
        return
      }
      element.setAttribute("checked", String(value))
      return
    default:
      return setDomAttribute(element, propToHtmlAttr(key), value)
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
  const val = unwrap(value)
  if (!val) {
    return element.removeAttribute("class")
  }
  element.setAttribute("class", val as string)
}

function setStyleProp(element: SomeElement, value: unknown, prev: unknown) {
  if (handleAttributeRemoval(element, "style", value)) return

  if (typeof value === "string") {
    element.setAttribute("style", value)
    return
  }

  let prevStyle: StyleObject = {}
  if (typeof prev === "string") {
    element.setAttribute("style", "")
  } else if (typeof prev === "object" && !!prev) {
    prevStyle = prev as StyleObject
  }

  const nextStyle = value as StyleObject
  const keys = new Set([
    ...Object.keys(prevStyle),
    ...Object.keys(nextStyle),
  ]) as Set<keyof StyleObject>

  keys.forEach((k) => {
    const prev = prevStyle[k]
    const next = nextStyle[k]
    if (prev === next) return

    if (next === undefined) {
      element.style[k as any] = ""
      return
    }

    element.style[k as any] = next as any
  })
}

function getDomParent(vNode: VNode): ElementVNode {
  let parentNode: VNode | null = vNode.parent
  let parentNodeElement = parentNode?.dom
  while (parentNode && !parentNodeElement) {
    parentNode = parentNode.parent
    parentNodeElement = parentNode?.dom
  }

  if (!parentNodeElement || !parentNode) {
    // handle app entry
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

function placeDom(vNode: DomVNode, hostNode: HostNode) {
  const { node: parentVNodeWithDom, lastChild } = hostNode
  const dom = vNode.dom
  if (lastChild) {
    lastChild.after(dom)
    return
  }
  // TODO: we can probably skip the 'next sibling search' if we're appending
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
      // Skip unmounted, to-be-placed & static nodes
      if (!(sibling.flags & (FLAG_PLACEMENT | FLAG_STATIC_DOM))) {
        // Descend into the child to find host dom
        const dom = findFirstHostDom(sibling)
        if (dom?.isConnected) return dom
      }
      sibling = sibling.sibling
    }

    // Move up to parent — but don't escape portal boundary
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
    if (node.flags & FLAG_STATIC_DOM) return // Don't descend into portals
    node = node.child
  }
  return
}

function commitWork(vNode: VNode) {
  if (renderMode.current === "hydrate") {
    return traverseApply(vNode, commitSnapshot)
  }

  const host: HostNode = {
    node: vNode.dom ? (vNode as ElementVNode) : getDomParent(vNode),
  }
  commitWork_impl(vNode, host, (vNode.flags & FLAG_PLACEMENT) > 0)
  if (vNode.dom && !(vNode.flags & FLAG_STATIC_DOM)) {
    commitDom(vNode as DomVNode, host, false)
  }
  commitSnapshot(vNode)
}

function commitWork_impl(
  vNode: VNode,
  currentHostNode: HostNode,
  inheritsPlacement: boolean
) {
  let child: VNode | null = vNode.child
  while (child) {
    if (child.flags & FLAG_NOOP) {
      if (child.flags & FLAG_PLACEMENT) {
        placeAndCommitNoopChildren(child, currentHostNode)
      }
      commitSnapshot(child)
      child = child.sibling
      continue
    }

    if (child.dom) {
      commitWork_impl(child, { node: child as ElementVNode }, false)
      if (!(child.flags & FLAG_STATIC_DOM)) {
        commitDom(child as DomVNode, currentHostNode, inheritsPlacement)
      }
    } else {
      commitWork_impl(
        child,
        currentHostNode,
        (child.flags & FLAG_PLACEMENT) > 0 || inheritsPlacement
      )
    }

    commitSnapshot(child)
    child = child.sibling
  }
}

function commitDom(
  vNode: DomVNode,
  hostNode: HostNode,
  inheritsPlacement: boolean
) {
  if (
    inheritsPlacement ||
    !vNode.dom.isConnected ||
    vNode.flags & FLAG_PLACEMENT
  ) {
    placeDom(vNode, hostNode)
  }
  if (!vNode.prev || vNode.flags & FLAG_UPDATE) {
    updateDom(vNode)
  }
  hostNode.lastChild = vNode.dom
}

function commitDeletion(vNode: VNode) {
  if (vNode === vNode.parent?.child) {
    vNode.parent.child = vNode.sibling
  }
  let ctx: AppContext
  if (__DEV__) {
    ctx = getVNodeAppContext(vNode)!
  }
  traverseApply(vNode, (node) => {
    const {
      hooks,
      subs,
      cleanups,
      dom,
      props: { ref },
    } = node

    subs?.forEach((unsub) => unsub())
    if (cleanups) Object.values(cleanups).forEach((c) => c())
    while (hooks?.length) hooks.pop()!.cleanup?.()

    if (__DEV__) {
      window.__kiru.profilingContext?.emit("removeNode", ctx)
      if (dom instanceof Element) {
        delete dom.__kiruNode
      }
    }

    if (dom) {
      if (ref) setDomRef(ref as Kiru.Ref<SomeDom>, null)
      if (dom.isConnected && !(node.flags & FLAG_STATIC_DOM)) {
        dom.remove()
      }
      delete node.dom
    }
  })

  vNode.parent = null
}

function placeAndCommitNoopChildren(
  parent: VNode,
  currentHostNode: HostNode
): void {
  if (!parent.child) return

  const domChildren: SomeDom[] = []
  collectDomNodes(parent.child, domChildren)
  if (domChildren.length === 0) return

  const { node, lastChild } = currentHostNode
  if (lastChild) {
    lastChild.after(...domChildren)
  } else {
    const nextSiblingDom = getNextSiblingDom(parent, node)
    const parentDom = node.dom
    if (nextSiblingDom) {
      nextSiblingDom.before(...domChildren)
    } else {
      parentDom.append(...domChildren)
    }
  }
  currentHostNode.lastChild = domChildren[domChildren.length - 1]
}

function collectDomNodes(firstChild: VNode, children: SomeDom[]): void {
  let child: VNode | null = firstChild
  while (child) {
    if (child.dom) {
      children.push(child.dom)
    } else if (child.child) {
      collectDomNodes(child.child, children)
    }
    child = child.sibling
  }
}
