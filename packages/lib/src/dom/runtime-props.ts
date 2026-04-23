import { __DEV__ } from "../env.js"
import { booleanAttributes } from "../constants.js"
import { propToHtmlAttr } from "../utils/index.js"
import { getNodeMeta } from "./metadata.js"
import { Signal } from "../signals/index.js"

const bindAttrToEventMap: Record<string, string> = {
  value: "input",
  checked: "change",
  open: "toggle",
  volume: "volumechange",
  playbackRate: "ratechange",
  currentTime: "timeupdate",
}
const numericValueInputTypes = new Set(["progress", "meter", "number", "range"])
const explicitValueElementTags = new Set(["INPUT", "TEXTAREA"])
const signalPropSources = new WeakMap<Element, Record<string, unknown>>()

export function applyProps(
  element: Element,
  props: Record<string, unknown>,
  prevProps?: Record<string, unknown>
) {
  const keys = Object.keys(props)
  if (keys.length > 1) maybeOrderPropKeys(keys)
  for (const key of keys) applyProp(element, key, props[key], prevProps?.[key])
}

export function removeProp(element: Element, key: string, prevValue: unknown) {
  const meta = getNodeMeta(element)
  const signalSubs = meta?.signalPropSubscriptions
  if (key.startsWith("on")) {
    const event = key.replace(/^on:?/, "").toLowerCase()
    const handler = meta?.eventHandlers?.[key]
    if (handler) {
      element.removeEventListener(event, handler)
      if (meta?.eventHandlers) delete meta.eventHandlers[key]
    }
    return
  }
  if (signalSubs?.[key]) {
    signalSubs[key]()
    delete signalSubs[key]
  }
  clearStyleSubscriptions(signalSubs)
  clearElementProp(element, key, prevValue)
}

function applyProp(
  element: Element,
  key: string,
  value: unknown,
  prevValue: unknown
) {
  if (key === "children" || key === "key") return
  const meta = getNodeMeta(element)
  const signalSubs = meta ? (meta.signalPropSubscriptions ??= {}) : undefined
  const sourceMap = signalPropSources.get(element) ?? {}
  if (!signalPropSources.has(element)) signalPropSources.set(element, sourceMap)

  const disposeProp = (propKey: string) => {
    const cleanup = signalSubs?.[propKey]
    if (cleanup) {
      cleanup()
      delete signalSubs[propKey]
    }
    if (propKey in sourceMap) {
      delete sourceMap[propKey]
    }
  }

  if (key.startsWith("on")) {
    const event = key.replace(/^on:?/, "").toLowerCase()
    if (!meta) return
    const handlers = (meta.eventHandlers ??= {})
    const prev = handlers[key]
    if (prev) {
      element.removeEventListener(event, prev)
      delete handlers[key]
    }
    if (typeof value === "function") {
      element.addEventListener(event, value as EventListener)
      handlers[key] = value as EventListener
    }
    return
  }

  if (key.startsWith("bind:")) {
    disposeProp(key)
    if (!Signal.isSignal(value)) return
    const attr = key.slice("bind:".length)
    const eventName = bindAttrToEventMap[attr]
    if (!eventName) {
      if (__DEV__) {
        console.error(
          `[kiru]: ${attr} is not a valid element binding attribute.`
        )
      }
      return
    }
    const writeElement =
      element.nodeName === "SELECT" && attr === "value"
        ? (next: unknown) =>
            setSelectElementValue(element as HTMLSelectElement, next)
        : (next: unknown) => {
            ;(element as unknown as Record<string, unknown>)[attr] = next
          }
    const writeSignal = (next: unknown, skip?: (value: unknown) => void) => {
      value.sneak(next)
      value.notify((sub) => sub !== skip)
    }
    const readElement =
      attr === "value"
        ? createElementValueReader(element)
        : () => (element as unknown as Record<string, unknown>)[attr]
    const updateFromSignal = (next: unknown) => writeElement(next)
    const updateFromElement = () => writeSignal(readElement(), updateFromSignal)

    const currentValue = value.peek()
    updateFromSignal(currentValue)
    const domValue = readElement()
    if (domValue !== currentValue) {
      writeSignal(domValue)
    }

    element.addEventListener(eventName, updateFromElement)
    const unsub = value.subscribe(updateFromSignal)
    if (signalSubs) {
      signalSubs[key] = () => {
        element.removeEventListener(eventName, updateFromElement)
        unsub()
      }
    }
    sourceMap[key] = value
    return
  }

  if (Signal.isSignal(value)) {
    if (sourceMap[key] === value && signalSubs?.[key]) return
    disposeProp(key)
    const apply = (next: unknown) =>
      setElementProp(element, key, next, prevValue, signalSubs)
    apply(value.peek())
    const unsub = value.subscribe(apply)
    if (signalSubs) signalSubs[key] = unsub
    sourceMap[key] = value
    return
  }

  if (signalSubs?.[key]) {
    disposeProp(key)
  }
  setElementProp(element, key, value, prevValue, signalSubs)
}

function maybeOrderPropKeys(keys: string[]) {
  const buckets: string[][] = [[], [], [], [], [], [], []]
  for (const key of keys) {
    if (key === "children" || key === "ref" || key === "key") continue
    const isEvent =
      key.length >= 2 && key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110
    const colonIdx = key.indexOf(":")
    const baseKey = colonIdx > -1 ? key.slice(colonIdx + 1) : key
    const priority = getBasePropPriority(baseKey, isEvent)
    const bucketIdx =
      priority <= 0
        ? 0
        : priority === 1
        ? 1
        : priority === 2
        ? 2
        : priority === 3
        ? 3
        : priority === 5
        ? 4
        : priority >= 9
        ? 6
        : 5
    buckets[bucketIdx].push(key)
  }
  let out = 0
  for (const bucket of buckets) {
    for (const key of bucket) keys[out++] = key
  }
}

function getBasePropPriority(baseKey: string, isEvent: boolean): number {
  if (isEvent) return 9
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

function setElementProp(
  element: Element,
  key: string,
  value: unknown,
  prev: unknown,
  signalSubs?: Record<string, () => void>
) {
  switch (key) {
    case "style":
      setStyleProp(element, value, prev, signalSubs)
      return
    case "className":
      setClassName(element, value)
      return
    case "innerHTML":
      setInnerHTML(element, value)
      return
    case "muted":
      ;(element as HTMLMediaElement).muted = Boolean(value)
      return
    case "value": {
      if (element.nodeName === "SELECT") {
        setSelectElementValue(element as HTMLSelectElement, value)
        return
      }
      const strVal = value === undefined || value === null ? "" : String(value)
      if (explicitValueElementTags.has(element.nodeName)) {
        ;(element as HTMLInputElement | HTMLTextAreaElement).value = strVal
        return
      }
      setDomAttribute(element, "value", strVal)
      return
    }
    case "checked":
      if (element.nodeName === "INPUT") {
        ;(element as HTMLInputElement).checked = Boolean(value)
        return
      }
      setDomAttribute(element, "checked", value)
      return
    default:
      setDomAttribute(element, propToHtmlAttr(key), value)
  }
}

function setDomAttribute(element: Element, key: string, value: unknown) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    (typeof value === "boolean" && booleanAttributes.has(key) && !value)
  ) {
    element.removeAttribute(key)
    return
  }
  element.setAttribute(
    key,
    booleanAttributes.has(key) && typeof value === "boolean"
      ? ""
      : String(value)
  )
}

function setInnerHTML(element: Element, value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean") {
    element.innerHTML = ""
    return
  }
  element.innerHTML = String(value)
}

function setClassName(element: Element, value: unknown) {
  if (!value) {
    element.removeAttribute("class")
    return
  }
  element.setAttribute("class", String(value))
}

function setStyleValue(
  styleElement: HTMLElement | SVGElement,
  key: string,
  value: unknown
) {
  const next = value === undefined || value === null ? "" : String(value)
  if (key.startsWith("--")) styleElement.style.setProperty(key, next)
  else (styleElement.style as unknown as Record<string, string>)[key] = next
}

function clearStyleSubscriptions(signalSubs?: Record<string, () => void>) {
  if (!signalSubs) return
  for (const key of Object.keys(signalSubs)) {
    if (key.startsWith("style:")) {
      signalSubs[key]()
      delete signalSubs[key]
    }
  }
}

function setStyleProp(
  element: Element,
  value: unknown,
  prev: unknown,
  signalSubs?: Record<string, () => void>
) {
  const styleElement = element as HTMLElement | SVGElement
  clearStyleSubscriptions(signalSubs)
  if (value === null || value === undefined || typeof value === "boolean") {
    element.removeAttribute("style")
    return
  }
  if (typeof value === "string") {
    element.setAttribute("style", value)
    return
  }
  const prevStyle =
    typeof prev === "object" && prev !== null
      ? (prev as Record<string, unknown>)
      : {}
  const nextStyle =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}

  for (const prevKey of Object.keys(prevStyle)) {
    if (!(prevKey in nextStyle)) {
      if (prevKey.startsWith("--")) styleElement.style.removeProperty(prevKey)
      else
        (styleElement.style as unknown as Record<string, string>)[prevKey] = ""
    }
  }

  for (const [nextKey, rawValue] of Object.entries(nextStyle)) {
    if (Signal.isSignal(rawValue)) {
      setStyleValue(styleElement, nextKey, rawValue.peek())
      if (signalSubs) {
        signalSubs[`style:${nextKey}`] = rawValue.subscribe((next) =>
          setStyleValue(styleElement, nextKey, next)
        )
      }
      continue
    }
    setStyleValue(styleElement, nextKey, rawValue)
  }
}

function clearElementProp(element: Element, key: string, prev: unknown) {
  switch (key) {
    case "style":
      setStyleProp(element, undefined, prev)
      return
    case "className":
      element.removeAttribute("class")
      return
    case "innerHTML":
      element.innerHTML = ""
      return
    case "muted":
      ;(element as HTMLMediaElement).muted = false
      return
    case "value":
      if (explicitValueElementTags.has(element.nodeName)) {
        ;(element as HTMLInputElement | HTMLTextAreaElement).value = ""
      } else if (element.nodeName === "SELECT") {
        ;(element as HTMLSelectElement).value = ""
      } else {
        element.removeAttribute("value")
      }
      return
    case "checked":
      if (element.nodeName === "INPUT") {
        ;(element as HTMLInputElement).checked = false
      } else {
        element.removeAttribute("checked")
      }
      return
    default:
      element.removeAttribute(propToHtmlAttr(key))
  }
}

function setSelectElementValue(dom: HTMLSelectElement, value: unknown) {
  if (!dom.multiple || value === undefined || value === null || value === "") {
    dom.value = String(value ?? "")
    return
  }
  const options = dom.options
  for (let i = 0; i < options.length; i++) {
    const option = options[i]
    option.selected = (value as string[]).indexOf(option.value) > -1
  }
}

function createElementValueReader(dom: Element) {
  if (dom.nodeName === "INPUT") {
    const input = dom as HTMLInputElement
    if (numericValueInputTypes.has(input.type)) {
      return () => input.valueAsNumber
    }
    return () => input.value
  }
  if (dom.nodeName === "SELECT") {
    const select = dom as HTMLSelectElement
    return () =>
      select.multiple
        ? Array.from(select.selectedOptions).map((option) => option.value)
        : select.value
  }
  return () => (dom as HTMLInputElement).value
}
