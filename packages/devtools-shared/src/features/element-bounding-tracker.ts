import * as kiru from "kiru"

interface ElementBindingTrackerOptions {
  windowScroll?: boolean
  windowResize?: boolean
}

interface ElementBindingTrackerState {
  width: kiru.Signal<number>
  height: kiru.Signal<number>
  top: kiru.Signal<number>
  left: kiru.Signal<number>
  right: kiru.Signal<number>
  bottom: kiru.Signal<number>
  x: kiru.Signal<number>
  y: kiru.Signal<number>
  scrollX: kiru.Signal<number>
  scrollY: kiru.Signal<number>
}

export function createElementBoundingTracker(
  element: Kiru.RefObject<Element | null>,
  options: ElementBindingTrackerOptions = {
    windowScroll: true,
    windowResize: true,
  }
) {
  const cleanups: (() => void)[] = []
  const dispose = () => {
    cleanups.forEach((cleanup) => cleanup())
    cleanups.length = 0
  }
  const windowScroll = options.windowScroll ?? true
  const windowResize = options.windowResize ?? true

  const width = kiru.signal(0)
  const height = kiru.signal(0)
  const top = kiru.signal(0)
  const left = kiru.signal(0)
  const right = kiru.signal(0)
  const bottom = kiru.signal(0)
  const x = kiru.signal(0)
  const y = kiru.signal(0)
  const scrollX = kiru.signal(0)
  const scrollY = kiru.signal(0)

  const update = () => {
    const el = element.current
    if (!el) {
      width.value =
        height.value =
        top.value =
        left.value =
        right.value =
        bottom.value =
        x.value =
        y.value =
        scrollX.value =
        scrollY.value =
          0
      return
    }
    width.value = el.clientWidth
    height.value = el.clientHeight

    const rect = el.getBoundingClientRect()
    top.value = rect.top
    left.value = rect.left
    right.value = rect.right
    bottom.value = rect.bottom
    x.value = rect.x
    y.value = rect.y
    scrollX.value = window.scrollX
    scrollY.value = window.scrollY
  }

  const init = () => {
    const el = element.current!
    if (!el) return console.error("element not found", new Error().stack)
    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(el, {
      attributeFilter: ["style", "class"],
      attributes: true,
      childList: true,
      subtree: true,
    })
    cleanups.push(() => mutationObserver.disconnect())

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(el)
    cleanups.push(() => resizeObserver.disconnect())

    if (windowScroll) {
      window.addEventListener("scroll", update, {
        capture: true,
        passive: true,
      })
      cleanups.push(() => window.removeEventListener("scroll", update))
    }
    if (windowResize) {
      window.addEventListener("resize", update, { passive: true })
      cleanups.push(() => window.removeEventListener("resize", update))
    }

    update()
  }

  return {
    state: { width, height, top, left, right, bottom, x, y, scrollX, scrollY },
    init,
    dispose,
  }
}
