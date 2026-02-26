import * as kiru from "kiru"

export const isOverlayShown = kiru.signal(false)
export const toggleOverlayShown = () =>
  (isOverlayShown.value = !isOverlayShown.value)
