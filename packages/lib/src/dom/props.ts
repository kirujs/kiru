import {
  propToHtmlAttr,
  getVNodeApp,
  setRef,
  registerVNodeCleanup,
} from "../utils/index.js"
import { booleanAttributes, EVENT_PREFIX_REGEX } from "../constants.js"
import { Signal } from "../signals/base.js"
import { unwrap } from "../signals/utils.js"
import { __DEV__, isBrowser } from "../env.js"
import { wrapFocusEventHandler } from "./focus.js"
import type { StyleObject } from "../types.dom.js"
import type { DomVNode, SomeDom, SomeElement } from "../types.utils.js"

export { updateDomProps }

type VNode = Kiru.VNode

interface VNodeEventListenerObjects {
  [key: string]: EventListenerObject
}

const eventListenerObjects = new WeakMap<VNode, VNodeEventListenerObjects>()
const skippedProps = new Set(["children", "ref", "key"])

// Reusable buckets for maybeOrderPropKeys — avoids per-call allocation.
// Safe because JS is single-threaded.
const _buckets: string[][] = [[], [], [], [], [], [], []]

const bindAttrToEventMap: Record<string, string> = {
  value: "input",
  checked: "change",
  open: "toggle",
  volume: "volumechange",
  playbackRate: "ratechange",
  currentTime: "timeupdate",
}

const numericValueInputTypes = new Set(["progress", "meter", "number", "range"])

// Reuse a Set for explicit-value element tag lookup (faster than indexOf on array)
const explicitValueElementTags = new Set(["INPUT", "TEXTAREA"])

function updateDomProps(vNode: DomVNode) {
  const { dom, prev, props, cleanups } = vNode
  const prevProps = prev?.props ?? {}
  const nextProps = props ?? {}

  if (isTextNode(dom)) {
    const nextVal = nextProps.nodeValue
    if (!Signal.isSignal(nextVal) && dom.nodeValue !== nextVal) {
      dom.nodeValue = nextVal
    }
    return
  }

  // Fast-path for first commit: no previous props, so we can skip diffing and
  // just apply all props (with ordering) directly.
  if (!prev) {
    mountDomProps(vNode, dom, nextProps, cleanups)
    const nextRef = nextProps.ref
    if (nextRef) setRef(nextRef, dom)
    return
  }

  // Use a Set to deduplicate keys that appear in both prevProps and nextProps.
  const execKeySet = new Set<string>()
  let styleKeyToSignal: Map<string, Signal<unknown>> | undefined
  let events: VNodeEventListenerObjects | undefined

  // Handle prevProps keys that may have been removed or changed.
  for (const key in prevProps) {
    const prevVal = prevProps[key]
    const nextVal = nextProps[key]

    if (prevVal === nextVal) continue // unchanged

    // Event removal
    if (
      key.length >= 2 &&
      key.charCodeAt(0) === 111 &&
      key.charCodeAt(1) === 110
    ) {
      // "on"
      if (!nextVal) {
        events ??= eventListenerObjects.get(vNode) ?? {}
        eventListenerObjects.set(vNode, events)

        const evtName = key.replace(EVENT_PREFIX_REGEX, "")
        const evtObj = events[evtName]
        if (evtObj) {
          dom.removeEventListener(evtName, evtObj)
          delete events[evtName]
        }
        continue
      }
    }

    // Cleanup previous signals
    if (Signal.isSignal(prevVal) && cleanups?.[key]) {
      cleanups[key]()
      delete cleanups[key]
    }

    execKeySet.add(key)
  }

  // Handle nextProps keys that are new or changed.
  for (const key in nextProps) {
    if (!(key in prevProps) || prevProps[key] !== nextProps[key]) {
      execKeySet.add(key)
    }
  }

  const execKeys = Array.from(execKeySet)

  // Analyze for constraint/value hazards only if multiple keys changed.
  if (isElementNode(dom) && execKeys.length > 1) {
    const changedSet = execKeySet // reuse the same set
    let seenConstraint = false
    let constraintChanged = false
    const valueLikeKeys: string[] = []
    let hasEvents = false
    let hasNonEvent = false

    for (const key in nextProps) {
      const isEvent =
        key.length >= 2 &&
        key.charCodeAt(0) === 111 &&
        key.charCodeAt(1) === 110 // "on"
      if (isEvent) hasEvents = true
      else hasNonEvent = true

      const baseKey = !isEvent && key.startsWith("bind:") ? key.slice(5) : key
      const priority = getBasePropPriority(baseKey, isEvent)

      if (priority === 1) {
        seenConstraint = true
        if (changedSet.has(key)) constraintChanged = true
      } else if (priority === 5) {
        valueLikeKeys.push(key)
      }
    }

    if (seenConstraint && constraintChanged) {
      for (const vk of valueLikeKeys) {
        if (!changedSet.has(vk) && vk in nextProps) {
          execKeys.push(vk)
          changedSet.add(vk)
        }
      }
    }

    const needsOrdering =
      (seenConstraint && constraintChanged) || (hasEvents && hasNonEvent)
    if (needsOrdering && execKeys.length > 1) maybeOrderPropKeys(execKeys)
  }

  // Apply updates
  for (let i = 0; i < execKeys.length; i++) {
    const key = execKeys[i]
    const prevVal = prevProps[key]
    const nextVal = nextProps[key]

    // Skip structural props early
    if (skippedProps.has(key)) continue

    // Events — charcode check is faster than startsWith for hot path
    if (
      key.length >= 2 &&
      key.charCodeAt(0) === 111 &&
      key.charCodeAt(1) === 110
    ) {
      // "on"
      events ??= eventListenerObjects.get(vNode) ?? {}
      eventListenerObjects.set(vNode, events)

      const evtName = key.replace(EVENT_PREFIX_REGEX, "")
      const evtObj = events[evtName]

      if (!nextVal) {
        if (evtObj) {
          dom.removeEventListener(evtName, evtObj)
          delete events[evtName]
        }
        continue
      }

      let handleEvent = nextVal.bind(void 0)
      if (evtName === "focus" || evtName === "blur")
        handleEvent = wrapFocusEventHandler(handleEvent)

      if (evtObj) {
        evtObj.handleEvent = handleEvent
        continue
      }

      dom.addEventListener(evtName, (events[evtName] = { handleEvent }))
      continue
    }

    // Signal
    if (Signal.isSignal(nextVal)) {
      setSignalProp(vNode, dom, key, nextVal, prevVal)
      continue
    }

    // Style
    if (key === "style" && typeof nextVal === "object" && nextVal !== null) {
      if (cleanups?.style) {
        cleanups.style()
        delete cleanups.style
      }
      if (!styleKeyToSignal) {
        styleKeyToSignal = new Map<string, Signal<unknown>>()
      }
      setStyleProp(dom, nextVal, prevVal, true, styleKeyToSignal)
      if (styleKeyToSignal.size > 0) {
        const unsubs: (() => void)[] = []
        for (const [k, sig] of styleKeyToSignal.entries()) {
          unsubs.push(
            sig.subscribe(
              k.startsWith("--")
                ? (v) => setCustomCSSStyleDecValue(dom, k, v)
                : (v) => setCSSStyleDecValue(dom, k, v)
            )
          )
        }
        styleKeyToSignal.clear()
        registerVNodeCleanup(vNode, "style", () => unsubs.forEach((u) => u()))
      }
      continue
    }

    setProp(dom, key, nextVal, prevVal)
  }

  // Ref
  const prevRef = prevProps.ref
  const nextRef = nextProps.ref
  if (prevRef !== nextRef) {
    if (prevRef) setRef(prevRef, null)
    if (nextRef) setRef(nextRef, dom)
  }
}

function mountDomProps(
  vNode: DomVNode,
  dom: SomeDom,
  props: Record<string, any>,
  cleanups?: DomVNode["cleanups"]
) {
  const keys = Object.keys(props)
  if (isElementNode(dom) && keys.length > 1) {
    maybeOrderPropKeys(keys)
  }

  let events: VNodeEventListenerObjects | undefined
  let styleKeyToSignal: Map<string, Signal<unknown>> | undefined

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = props[key]

    if (skippedProps.has(key)) continue

    // Events
    if (
      key.length >= 2 &&
      key.charCodeAt(0) === 111 &&
      key.charCodeAt(1) === 110
    ) {
      // "on"
      if (!value) continue

      events ??= eventListenerObjects.get(vNode) ?? {}
      eventListenerObjects.set(vNode, events)

      const evtName = key.replace(EVENT_PREFIX_REGEX, "")
      const evtObj = events[evtName]

      let handleEvent = value.bind(void 0)
      if (evtName === "focus" || evtName === "blur") {
        handleEvent = wrapFocusEventHandler(handleEvent)
      }

      if (evtObj) {
        evtObj.handleEvent = handleEvent
      } else {
        dom.addEventListener(evtName, (events[evtName] = { handleEvent }))
      }
      continue
    }

    // Signals
    if (Signal.isSignal(value)) {
      setSignalProp(vNode, dom as Exclude<SomeDom, Text>, key, value, undefined)
      continue
    }

    // Style
    if (key === "style" && typeof value === "object" && value !== null) {
      if (cleanups?.style) {
        cleanups.style()
        delete cleanups.style
      }
      if (!styleKeyToSignal) {
        styleKeyToSignal = new Map<string, Signal<unknown>>()
      }
      setStyleProp(dom as SomeElement, value, undefined, true, styleKeyToSignal)
      if (styleKeyToSignal.size > 0) {
        const unsubs: (() => void)[] = []
        for (const [k, sig] of styleKeyToSignal.entries()) {
          unsubs.push(
            sig.subscribe(
              k.startsWith("--")
                ? (v) => setCustomCSSStyleDecValue(dom as SomeElement, k, v)
                : (v) => setCSSStyleDecValue(dom as SomeElement, k, v)
            )
          )
        }
        styleKeyToSignal.clear()
        registerVNodeCleanup(vNode, "style", () => unsubs.forEach((u) => u()))
      }
      continue
    }

    setProp(dom as SomeElement, key, value, undefined)
  }
}

function maybeOrderPropKeys(keys: string[]) {
  if (keys.length <= 1) return

  // Clear reusable buckets
  for (let b = 0; b < 7; b++) _buckets[b].length = 0

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const isEvent =
      key.length >= 2 && key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 // "on"

    let baseKey = key
    if (!isEvent && key.length > 5 && key.charCodeAt(4) === 58) {
      // "bind:"
      baseKey = key.slice(5)
    }

    const priority = getBasePropPriority(baseKey, isEvent)

    let bucketIdx: number
    if (priority <= 0) bucketIdx = 0
    else if (priority === 1) bucketIdx = 1
    else if (priority === 2) bucketIdx = 2
    else if (priority === 3) bucketIdx = 3
    else if (priority === 5) bucketIdx = 4
    else if (priority >= 9) bucketIdx = 6
    else bucketIdx = 5

    _buckets[bucketIdx].push(key)
  }

  let outIdx = 0
  for (let b = 0; b < 7; b++) {
    const bucket = _buckets[b]
    for (let i = 0; i < bucket.length; i++) {
      keys[outIdx++] = bucket[i]
    }
  }
}

function getBasePropPriority(baseKey: string, isEvent: boolean): number {
  if (isEvent) return 9

  // Use first char to narrow comparisons
  switch (baseKey) {
    case "innerHTML":
    case "type":
    case "muted":
    case "autoplay":
    case "loop":
      return 0
    case "min":
    case "max":
    case "step":
    case "pattern":
    case "accept":
    case "multiple":
    case "preload":
    case "minLength":
    case "maxLength":
    case "crossOrigin":
    case "decoding":
    case "loading":
    case "referrerPolicy":
      return 1
    case "style":
    case "className":
      return 3
    case "value":
    case "checked":
    case "selected":
    case "open":
    case "src":
      return 5
    default:
      return 4
  }
}

function setSelectElementValue(dom: HTMLSelectElement, value: any) {
  if (!dom.multiple || value === undefined || value === null || value === "") {
    dom.value = value
    return
  }
  const options = dom.options
  const len = options.length
  for (let i = 0; i < len; i++) {
    const option = options[i]
    option.selected = value.indexOf(option.value) > -1
  }
}

function setSignalProp(
  vNode: VNode,
  dom: Exclude<SomeDom, Text>,
  key: string,
  signal: Signal<any>,
  prevValue: unknown
) {
  const colonIdx = key.indexOf(":")
  const modifier = colonIdx === -1 ? key : key.slice(0, colonIdx)
  const attr = colonIdx === -1 ? undefined : key.slice(colonIdx + 1)

  if (modifier === "bind") {
    const evtName = bindAttrToEventMap[attr!]
    if (!evtName) {
      if (__DEV__) {
        console.error(
          `[kiru]: ${attr} is not a valid element binding attribute.`
        )
      }
      return
    }
    const value = signal.peek()
    const cleanup = bindElementProp(vNode, dom, attr!, evtName, signal, value)
    registerVNodeCleanup(vNode, key, cleanup)
  } else {
    const unsub = signal.subscribe((value, prev) => {
      if (value === prev) return
      setProp(dom, key, value, prev)
      if (__DEV__) {
        emitSignalAttrUpdate(vNode)
      }
    })
    registerVNodeCleanup(vNode, key, unsub)
  }

  const value = signal.peek()
  const prev = unwrap(prevValue)
  if (modifier !== "bind" && value !== prev) {
    setProp(dom, attr ?? modifier, value, prev)
  }
}

function bindElementProp(
  vNode: VNode,
  dom: Exclude<SomeDom, Text>,
  attr: string,
  evtName: string,
  signal: Signal<any>,
  initialValue?: any
): () => void {
  const writeToSignal = (val: any) => {
    signal.sneak(val)
    signal.notify((sub) => sub !== updateFromSignal)
  }

  const writeToElement =
    dom.nodeName === "SELECT" && attr === "value"
      ? (value: any) => setSelectElementValue(dom as HTMLSelectElement, value)
      : (value: any) => ((dom as any)[attr] = value)

  const updateFromSignal = (value: any) => {
    writeToElement(value)
    if (__DEV__) {
      emitSignalAttrUpdate(vNode)
    }
  }

  let readValue: (() => any) | undefined
  let evtHandler: EventListener
  if (attr === "value") {
    readValue = createElementValueReader(dom)
    evtHandler = () => writeToSignal(readValue!())
  } else {
    evtHandler = () => {
      const val = (dom as any)[attr]
      if (attr === "currentTime" && signal.peek() === val) return
      writeToSignal(val)
    }
  }

  if (initialValue !== undefined) {
    updateFromSignal(initialValue)
  }

  // After binding is established, always reconcile the signal with the
  // element's current value. This ensures that any browser coercion
  // (clamping, defaulting, etc.) is reflected back into the signal,
  // even when the initial signal value was undefined.
  let domVal: any
  if (attr === "value" && readValue) {
    domVal = readValue()
  } else {
    domVal = (dom as any)[attr]
  }

  const current = signal.peek()
  if (domVal !== current) {
    writeToSignal(domVal)
  }

  dom.addEventListener(evtName, evtHandler)
  const unsub = signal.subscribe(updateFromSignal)

  return () => {
    dom.removeEventListener(evtName, evtHandler)
    unsub()
  }
}

function setProp(
  element: SomeElement,
  key: string,
  value: unknown,
  prev: unknown
) {
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
      if (explicitValueElementTags.has(element.nodeName)) {
        ;(element as HTMLInputElement | HTMLTextAreaElement).value = strVal
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

function setDomAttribute(element: Element, key: string, value: unknown) {
  const isBoolAttr = booleanAttributes.has(key)

  if (handleAttributeRemoval(element, key, value, isBoolAttr)) return

  element.setAttribute(
    key,
    isBoolAttr && typeof value === "boolean" ? "" : String(value)
  )
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

function setCustomCSSStyleDecValue(
  element: SomeElement,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) {
    element.style.removeProperty(key)
    return
  }
  element.style.setProperty(key, String(value))
}

function setCSSStyleDecValue(
  element: SomeElement,
  key: string,
  value: unknown
): void {
  element.style[key as any] =
    value !== undefined && value !== null ? String(value) : ""
}

function setStyleProp(
  element: SomeElement,
  value: unknown,
  prev: unknown,
  trackSignals = false,
  // Passed in from updateDom to avoid allocating a new Map per style update
  signalMap?: Map<string, Signal<unknown>>
): void {
  if (handleAttributeRemoval(element, "style", value)) return

  const raw = unwrap(value)
  if (raw === null || raw === undefined) {
    element.removeAttribute("style")
    return
  }
  if (typeof raw === "string") {
    element.setAttribute("style", raw)
    return
  }

  let prevStyle: StyleObject = {}
  const rawPrev = unwrap(prev)
  if (typeof rawPrev === "string") {
    element.setAttribute("style", "")
  } else if (typeof rawPrev === "object" && rawPrev !== null) {
    prevStyle = rawPrev as StyleObject
  }

  const nextStyle = raw as StyleObject
  const prevKeys = Object.keys(prevStyle)
  const nextKeys = Object.keys(nextStyle)

  // Avoid Set allocation for the common case where prevStyle is empty
  if (prevKeys.length === 0) {
    for (let i = 0; i < nextKeys.length; i++) {
      const k = nextKeys[i] as keyof StyleObject
      const rawNext = nextStyle[k]
      const nextVal = unwrap(rawNext)
      if (trackSignals && Signal.isSignal(rawNext)) {
        signalMap?.set(k, rawNext)
      }
      if (k.startsWith("--")) {
        setCustomCSSStyleDecValue(element, k, nextVal)
      } else {
        setCSSStyleDecValue(element, k, nextVal)
      }
    }
    return
  }

  // Full merge path: iterate prevKeys for removals, nextKeys for additions/changes
  const nextStyleKeys = new Set(nextKeys)
  for (let i = 0; i < prevKeys.length; i++) {
    const k = prevKeys[i] as keyof StyleObject
    if (!nextStyleKeys.has(k)) {
      // Property was removed
      if ((k as string).startsWith("--")) {
        setCustomCSSStyleDecValue(element, k as string, undefined)
      } else {
        setCSSStyleDecValue(element, k as string, undefined)
      }
    }
  }

  for (let i = 0; i < nextKeys.length; i++) {
    const k = nextKeys[i] as keyof StyleObject
    const rawNext = nextStyle[k]
    const prevVal = unwrap(prevStyle[k])
    const nextVal = unwrap(rawNext)
    if (prevVal === nextVal) continue
    if (trackSignals && Signal.isSignal(rawNext)) {
      signalMap?.set(k, rawNext)
    }
    if ((k as string).startsWith("--")) {
      setCustomCSSStyleDecValue(element, k as string, nextVal)
    } else {
      setCSSStyleDecValue(element, k as string, nextVal)
    }
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

function createElementValueReader(dom: Exclude<SomeDom, Text>) {
  if (dom.nodeName === "INPUT") {
    return createInputValueReader(dom as HTMLInputElement)
  }
  if (dom.nodeName === "SELECT") {
    return () => getSelectElementValue(dom as HTMLSelectElement)
  }
  return () => (dom as any).value
}

function createInputValueReader(dom: HTMLInputElement): () => any {
  const t = dom.type
  if (numericValueInputTypes.has(t)) {
    return () => dom.valueAsNumber
  }
  return () => dom.value
}

function getSelectElementValue(dom: HTMLSelectElement) {
  if (dom.multiple) {
    return Array.from(dom.selectedOptions).map((option) => option.value)
  }
  return dom.value
}

function emitSignalAttrUpdate(vNode: VNode) {
  if (!isBrowser) return
  window.__kiru?.profilingContext?.emit("signalAttrUpdate", getVNodeApp(vNode)!)
}

function isElementNode(dom: SomeDom): dom is HTMLElement | SVGElement {
  return dom.nodeType === 1
}

function isTextNode(dom: SomeDom): dom is Text {
  return dom.nodeType === 3
}
