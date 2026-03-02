import { call } from "../utils/index.js"

let persistingFocus = false
let focussedElement: HTMLElement | null = null
export const postHookCleanups: (() => void)[] = []

const placementBlurHandler = (event: FocusEvent) => {
  event.preventDefault()
  event.stopPropagation()
}

export function onBeforeFlushDomChanges() {
  const el = document.activeElement
  if (el === document.body || !(el instanceof HTMLElement)) {
    return
  }
  el.addEventListener("blur", placementBlurHandler)
  persistingFocus = true
  focussedElement = el
}

export function onAfterFlushDomChanges() {
  if (focussedElement) {
    focussedElement.removeEventListener("blur", placementBlurHandler)
    if (focussedElement.isConnected) focussedElement.focus()
    focussedElement = null
    persistingFocus = false
  }
  queueMicrotask(() => {
    postHookCleanups.forEach(call)
    postHookCleanups.length = 0
  })
}

export function wrapFocusEventHandler(callback: (event: FocusEvent) => void) {
  return (event: FocusEvent) => {
    if (persistingFocus) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    callback(event)
  }
}
