import * as kiru from "kiru"

export const isOverlayShown = kiru.signal(false)
export const toggleOverlayShown = () =>
  (isOverlayShown.value = !isOverlayShown.value)
export const hideOverlay = () => (isOverlayShown.value = false)

export const isProfilerShown = kiru.signal(false)

export const isDebuggerShown = kiru.signal(false)

/** Widget stack: last-hovered widget is on top. Main menu is always above widgets. */
export type WidgetStackId = "profiler" | "debugger"
export const WIDGET_Z_BASE = 50
export const widgetStackTop = kiru.signal<WidgetStackId | null>(null)
