import * as Kiru from "kiru"
import { assignCustomStylePropertiesForSize, createRefProxy } from "../utils.js"
import type { HtmlOrSvgElement } from "../types"

/**
 * Shared logic for animated expand/collapse content panels.
 *
 * Used by both `CollapsibleContent` and `AccordionContent` — they are
 * identical in behaviour: the only differences are the CSS custom-property
 * prefix and which open-signal they subscribe to.
 *
 * @param isOpen  - reactive signal that drives open/closed state
 * @param sizePropertyPrefix  - CSS custom-property prefix passed to
 *                  `assignCustomStylePropertiesForSize`
 *                  (e.g. `"collapsible-content"` | `"accordion-content"`)
 */
export function useContentPanel(isOpen: Kiru.Signal<boolean>) {
  const wasOpenInitially = isOpen.peek()
  const hidden = Kiru.signal(!wasOpenInitially)
  const refProxy = createRefProxy<HtmlOrSvgElement>((el) => (element = el))
  let element: HtmlOrSvgElement | null = null

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
    if (!element) return void (hidden.value = true)
    const e = ++epoch

    if (!capturedAnimationStyles) captureAndPreventAnimationStyles(element)
    hidden.value = false

    // Wait one frame so the browser can recalculate layout before we measure.
    await new Promise<number>(requestAnimationFrame)

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
