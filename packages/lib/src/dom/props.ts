import {
  propToHtmlAttr,
  getVNodeApp,
  setRef,
  registerVNodeCleanup,
} from "../utils/index.js"
import { booleanAttributes, EVENT_PREFIX_REGEX } from "../constants.js"
import { Signal } from "../signals/base.js"
import { unwrap } from "../signals/utils.js"
import { renderMode } from "../globals.js"
import { __DEV__ } from "../env.js"
import { wrapFocusEventHandler } from "./focus.js"
import type { StyleObject } from "../types.dom.js"
import type { DomVNode, SomeDom, SomeElement } from "../types.utils.js"

type VNode = Kiru.VNode

interface VNodeEventListenerObjects {
  [key: string]: EventListenerObject
}

const eventListenerObjects = new WeakMap<VNode, VNodeEventListenerObjects>()
const styleKeyToSignal = new Map<string, Signal<unknown>>()

export function updateDom(vNode: DomVNode) {
  const { dom, prev, props, cleanups } = vNode
  const prevProps = prev?.props ?? {}
  const nextProps = props ?? {}
  const isHydration = renderMode.current === "hydrate"

  if (dom instanceof Text) {
    const nextVal = nextProps.nodeValue
    if (!Signal.isSignal(nextVal) && dom.nodeValue !== nextVal) {
      dom.nodeValue = nextVal
    }
    return
  }

  const keys: string[] = []
  for (const k in prevProps) keys.push(k)
  for (const k in nextProps) {
    if (!(k in prevProps)) keys.push(k)
  }

  let events: VNodeEventListenerObjects | undefined
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const prevVal = prevProps[key]
    const nextVal = nextProps[key]

    if (key.length >= 2 && key.startsWith("on")) {
      events ??= eventListenerObjects.get(vNode)
      if (!events) eventListenerObjects.set(vNode, (events = {}))

      if (prevVal !== nextVal || isHydration) {
        const evtName = key.replace(EVENT_PREFIX_REGEX, "")
        const evtListenerObj = events[evtName]

        if (!nextVal) {
          if (evtListenerObj) {
            dom.removeEventListener(evtName, evtListenerObj)
            delete events[evtName]
          }
          continue
        }

        let handleEvent = nextVal.bind(void 0)
        if (evtName === "focus" || evtName === "blur") {
          handleEvent = wrapFocusEventHandler(handleEvent)
        }

        if (evtListenerObj) {
          evtListenerObj.handleEvent = handleEvent
          continue
        }

        dom.addEventListener(evtName, (events[evtName] = { handleEvent }))
      }
      continue
    }

    if (key === "children" || key === "ref" || key === "key") {
      continue
    }

    if (prevVal === nextVal) {
      continue
    }

    if (Signal.isSignal(prevVal) && cleanups) {
      const disposer = cleanups[key]
      if (disposer) {
        disposer()
        delete cleanups[key]
      }
    }

    if (Signal.isSignal(nextVal)) {
      setSignalProp(vNode, dom, key, nextVal, prevVal)
      continue
    }

    if (key === "style" && typeof nextVal === "object" && nextVal !== null) {
      if (cleanups?.style) {
        cleanups.style()
        delete cleanups.style
      }
      setStyleProp(dom, nextVal, prevVal, true)
      if (styleKeyToSignal.size > 0) {
        const unsubs: (() => void)[] = []
        styleKeyToSignal.forEach((sig, k) => {
          let cb
          if (k.startsWith("--")) {
            cb = sig.subscribe((v) => setCustomCSSStyleDecValue(dom, k, v))
          } else {
            cb = sig.subscribe((v) => setCSSStyleDecValue(dom, k, v))
          }

          unsubs.push(cb)
        })
        styleKeyToSignal.clear()
        registerVNodeCleanup(vNode, "style", () => unsubs.forEach((u) => u()))
      }
      continue
    }

    setProp(dom, key, nextVal, prevVal)
  }

  const prevRef = prevProps.ref
  const nextRef = nextProps.ref
  if (prevRef !== nextRef) {
    if (prevRef) setRef(prevRef, null)
    if (nextRef) setRef(nextRef, dom)
  }
}

function getSelectElementValue(dom: HTMLSelectElement) {
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

const numericValueInputTypes = new Set(["progress", "meter", "number", "range"])

export function setSignalProp(
  vNode: VNode,
  dom: Exclude<SomeDom, Text>,
  key: string,
  signal: Signal<any>,
  prevValue: unknown
) {
  const [modifier, attr] = key.split(":")
  if (modifier !== "bind") {
    const unsub = signal.subscribe((value, prev) => {
      if (value === prev) return
      setProp(dom, key, value, prev)
      if (__DEV__) {
        emitSignalAttrUpdate(vNode)
      }
    })
    registerVNodeCleanup(vNode, key, unsub)
  } else {
    const evtName = bindAttrToEventMap[attr]
    if (!evtName) {
      if (__DEV__) {
        console.error(
          `[kiru]: ${attr} is not a valid element binding attribute.`
        )
      }
      return
    }
    const cleanup = bindElementProp(vNode, dom, attr, evtName, signal)
    registerVNodeCleanup(vNode, key, cleanup)
  }

  const value = signal.peek()
  const prev = unwrap(prevValue)
  if (value !== prev) {
    setProp(dom, attr ?? modifier, value, prev)
  }
}

function createElementValueReader(
  dom: Exclude<SomeDom, Text>,
  signal: Signal<any>
) {
  if (dom instanceof HTMLInputElement) {
    return createInputValueReader(dom, signal)
  }
  if (dom instanceof HTMLSelectElement) {
    return () => getSelectElementValue(dom)
  }
  return () => (dom as any).value
}

function bindElementProp(
  vNode: VNode,
  dom: Exclude<SomeDom, Text>,
  attr: string,
  evtName: string,
  signal: Signal<any>
): () => void {
  const writeToSignal = (val: any) => {
    signal.sneak(val)
    signal.notify((sub) => sub !== updateFromSignal)
  }

  const writeToElement =
    dom instanceof HTMLSelectElement && attr === "value"
      ? (value: any) => setSelectElementValue(dom, value)
      : (value: any) => ((dom as any)[attr] = value)

  const updateFromSignal = (value: any) => {
    writeToElement(value)
    if (__DEV__) {
      emitSignalAttrUpdate(vNode)
    }
  }

  let evtHandler: EventListener
  if (attr === "value") {
    const readValue = createElementValueReader(dom, signal)
    evtHandler = () => writeToSignal(readValue())
  } else {
    evtHandler = () => {
      const val = (dom as any)[attr]
      if (attr === "currentTime" && signal.peek() === val) return
      writeToSignal(val)
    }
  }

  dom.addEventListener(evtName, evtHandler)
  const unsub = signal.subscribe(updateFromSignal)

  return () => {
    dom.removeEventListener(evtName, evtHandler)
    unsub()
  }
}

function createInputValueReader(
  dom: HTMLInputElement,
  signal: Signal<any>
): () => any {
  const t = dom.type
  const v = signal.peek()

  if (t === "date" && v instanceof Date) {
    return () => dom.valueAsDate
  }

  if (numericValueInputTypes.has(t) && typeof v === "number") {
    return () => dom.valueAsNumber
  }

  return () => dom.value
}

function emitSignalAttrUpdate(vNode: VNode) {
  window.__kiru.profilingContext?.emit("signalAttrUpdate", getVNodeApp(vNode)!)
}

export function subTextNode(
  vNode: VNode,
  textNode: Text,
  signal: Signal<string>
) {
  const cleanup = signal.subscribe((value, prev) => {
    if (value === prev) return
    textNode.nodeValue = value
    if (__DEV__) {
      window.__kiru.profilingContext?.emit(
        "signalTextUpdate",
        getVNodeApp(vNode)!
      )
    }
  })
  registerVNodeCleanup(vNode, "nodeValue", cleanup)
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

export function setProp(
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
  trackSignals = false
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
  } else if (typeof rawPrev === "object" && !!rawPrev) {
    prevStyle = rawPrev as StyleObject
  }

  const nextStyle = raw as StyleObject
  const keys = new Set([
    ...Object.keys(prevStyle),
    ...Object.keys(nextStyle),
  ]) as Set<keyof StyleObject>

  keys.forEach((k) => {
    const rawNext = nextStyle[k]
    const prevVal = unwrap(prevStyle[k])
    const nextVal = unwrap(rawNext)
    if (prevVal === nextVal) return
    if (trackSignals && Signal.isSignal(rawNext)) {
      styleKeyToSignal?.set(k, rawNext)
    }

    if (k.startsWith("--")) {
      return setCustomCSSStyleDecValue(element, k, nextVal)
    }

    setCSSStyleDecValue(element, k, nextVal)
  })
}
