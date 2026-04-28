import * as Kiru from "kiru"
import { createRefProxy } from "../utils/index.js"
import type { HtmlOrSvgElement } from "../types"

/**
 * Shared logic for animated expand/collapse content panels.
 *
 * @param isOpen  - reactive signal that drives open/closed state
 */
export function useContentPanel(isOpen: Kiru.Signal<boolean>) {
  const hidden = Kiru.signal(!isOpen.peek())
  const refProxy = createRefProxy<HtmlOrSvgElement>()

  // ── Animation style capture ──────────────────────────────────────────────
  // We briefly zero-out animation/transition so that measuring the element's
  // size doesn't trigger an unintended animation, then restore afterwards.

  let capturedAnimationStyles: {
    animationName: string
    transitionDuration: string
  } | null = null

  const captureAndPreventAnimationStyles = (el: HtmlOrSvgElement) => {
    const { animationName, transitionDuration } = el.style
    capturedAnimationStyles = { animationName, transitionDuration }
    el.style.animationName = "none"
    el.style.transitionDuration = "0s"
  }

  const assignCapturedAnimationStyles = (el: HtmlOrSvgElement) => {
    if (capturedAnimationStyles === null) return
    el.style.animationName = capturedAnimationStyles.animationName
    el.style.transitionDuration = capturedAnimationStyles.transitionDuration
    capturedAnimationStyles = null
  }

  // ── Mount: measure without animation if already open ────────────────────

  Kiru.onBeforeMount(() => {
    const element = refProxy.current
    if (!element) return
    if (isOpen.peek()) {
      captureAndPreventAnimationStyles(element)
      assignCustomStylePropertiesForSize(element)
    }
  })

  // ── Subscribe: drive hidden + size custom-properties ────────────────────
  // The `epoch` guard ensures that a rapid open→close sequence doesn't
  // accidentally hide the element after a subsequent open animation finishes.

  let epoch = 0
  isOpen.subscribe(async (open) => {
    const element = refProxy.current
    if (!element) return void (hidden.value = true)
    const e = ++epoch

    if (!capturedAnimationStyles) captureAndPreventAnimationStyles(element)
    hidden.value = false

    // Wait one frame so the browser can recalculate layout before we measure.
    await new Promise(requestAnimationFrame)

    assignCustomStylePropertiesForSize(element)
    assignCapturedAnimationStyles(element)

    if (open) return

    // When closing, wait for any CSS animations/transitions to finish before
    // actually hiding the element (so the close animation plays out).
    const animations = element.getAnimations()
    await Promise.allSettled(animations.map((a) => a.finished))
    if (e === epoch) {
      hidden.value = true
    }
  })

  return { hidden, refProxy }
}

function assignCustomStylePropertiesForSize(element: HtmlOrSvgElement) {
  const { height, width } = element.getBoundingClientRect()
  element.style.setProperty(`--content-height`, `${height}px`)
  element.style.setProperty(`--content-width`, `${width}px`)
}
