let focussedElement: HTMLElement | null = null

export function captureFocus() {
  const el = document.activeElement
  if (el === document.body || !(el instanceof HTMLElement)) {
    return
  }
  el.addEventListener("blur", placementBlurHandler)
  focussedElement = el
}

export function reinstateFocus() {
  if (focussedElement) {
    focussedElement.removeEventListener("blur", placementBlurHandler)
    if (focussedElement.isConnected) focussedElement.focus()
    focussedElement = null
  }
}

export function wrapFocusEventHandler(callback: (event: FocusEvent) => void) {
  return (event: FocusEvent) => {
    if (focussedElement) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    callback(event)
  }
}

function placementBlurHandler(event: FocusEvent) {
  event.preventDefault()
  event.stopPropagation()
}
