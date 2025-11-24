import { useLayoutEffect, useSignal } from "kiru"
import { useEventListener } from "./useEventListener"
import { useResizeObserver } from "./useResizeObserver"
import { useMutationObserver } from "./useMutationObserver"

type UseElementBoundingOptions = {
  windowScroll?: boolean
  windowResize?: boolean
  immediate?: boolean
}

export const useElementBounding = (
  ref: Kiru.RefObject<Element | null>,
  options: UseElementBoundingOptions = {
    windowScroll: true,
    windowResize: true,
  }
) => {
  const windowScroll = options?.windowScroll ?? true
  const windowResize = options?.windowResize ?? true
  const immediate = options.immediate ?? true

  const width = useSignal(0)
  const height = useSignal(0)
  const top = useSignal(0)
  const right = useSignal(0)
  const bottom = useSignal(0)
  const left = useSignal(0)
  const x = useSignal(0)
  const y = useSignal(0)

  const update = () => {
    const el = ref.current

    if (!el) {
      width.value = 0
      height.value = 0
      top.value = 0
      right.value = 0
      bottom.value = 0
      left.value = 0
      x.value = 0
      y.value = 0
      return
    }

    const bounding = el.getBoundingClientRect()
    width.value = bounding.width
    height.value = bounding.height
    top.value = bounding.top
    right.value = bounding.right
    bottom.value = bounding.bottom
    left.value = bounding.left
    x.value = bounding.x
    y.value = bounding.y
  }

  useResizeObserver(ref, update)
  useMutationObserver(ref, update, {
    attributeFilter: ["style", "class"],
  })

  useEventListener(
    "scroll",
    () => {
      if (windowScroll) {
        update()
      }
    },
    { capture: true, passive: true }
  )

  useEventListener(
    "resize",
    () => {
      if (windowResize) {
        update()
      }
    },
    { passive: true }
  )

  useLayoutEffect(() => {
    if (immediate) {
      update()
    }
  }, [])

  return {
    width,
    height,
    top,
    right,
    bottom,
    left,
    x,
    y,
    update,
  }
}
