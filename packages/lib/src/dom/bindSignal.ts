import type { Signal } from "../signals/base.js"

const bindAttrToEventMap: Record<string, string> = {
  value: "input",
  checked: "change",
  open: "toggle",
  volume: "volumechange",
  playbackRate: "ratechange",
  currentTime: "timeupdate",
}

const numericValueInputTypes = new Set(["progress", "meter", "number", "range"])

function setSelectElementValue(dom: HTMLSelectElement, value: unknown): void {
  if (!dom.multiple || value === undefined || value === null || value === "") {
    dom.value = value as string
    return
  }
  const options = dom.options
  const len = options.length
  for (let i = 0; i < len; i++) {
    const option = options[i]!
    option.selected = (value as string[]).indexOf(option.value) > -1
  }
}

function createInputValueReader(dom: HTMLInputElement): () => unknown {
  const t = dom.type
  if (numericValueInputTypes.has(t)) {
    return () => {
      const value = dom.valueAsNumber
      return isNaN(value) ? 0 : value
    }
  }
  return () => dom.value
}

function getSelectElementValue(dom: HTMLSelectElement): unknown {
  if (dom.multiple) {
    return Array.from(dom.selectedOptions).map((option) => option.value)
  }
  return dom.value
}

function createElementValueReader(dom: Element): () => unknown {
  if (dom.nodeName === "INPUT") {
    return createInputValueReader(dom as HTMLInputElement)
  }
  if (dom.nodeName === "SELECT") {
    return () => getSelectElementValue(dom as HTMLSelectElement)
  }
  return () => (dom as HTMLInputElement).value
}

/** Two-way bind between a DOM property and a signal (no VNode). Returns cleanup. */
export function bindElementSignal(
  dom: Element,
  attr: string,
  signal: Signal<unknown>,
  initialValue?: unknown
): () => void {
  const evtName = bindAttrToEventMap[attr]
  if (!evtName) {
    throw new Error(`[kiru/dom]: bind:${attr} is not supported`)
  }

  const writeToSignal = (val: unknown) => {
    signal.sneak(val)
    signal.notify((sub) => sub !== updateFromSignal)
  }

  const writeToElement =
    dom.nodeName === "SELECT" && attr === "value"
      ? (value: unknown) => setSelectElementValue(dom as HTMLSelectElement, value)
      : (value: unknown) => {
          ;(dom as unknown as Record<string, unknown>)[attr] = value
        }

  const updateFromSignal = (value: unknown) => {
    writeToElement(value)
  }

  let readValue: (() => unknown) | undefined
  let evtHandler: EventListener
  if (attr === "value") {
    readValue = createElementValueReader(dom)
    evtHandler = () => writeToSignal(readValue!())
  } else {
    evtHandler = () => {
      const val = (dom as unknown as Record<string, unknown>)[attr]
      if (attr === "currentTime" && signal.peek() === val) return
      writeToSignal(val)
    }
  }

  if (initialValue !== undefined) {
    updateFromSignal(initialValue)
  }

  let domVal: unknown
  if (attr === "value" && readValue) {
    domVal = readValue()
  } else {
    domVal = (dom as unknown as Record<string, unknown>)[attr]
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
