import * as kiru from "kiru"

export const isOverlayShown = kiru.signal(false)
export const toggleOverlayShown = () =>
  (isOverlayShown.value = !isOverlayShown.value)
export const hideOverlay = () => (isOverlayShown.value = false)

export const isProfilerShown = kiru.signal(false)
export const isDebuggerShown = kiru.signal(false)
export const isComponentSelectorEnabled = kiru.signal(false)

export interface ComponentInfoPanelState {
  id: string
  name: string
  link: string
  component: Kiru.VNode
  unmounted: boolean
  hash: string
}

/** All open component info panels. */
export const componentInfoPanels = kiru.signal<ComponentInfoPanelState[]>([])

export const isComponentInfoPanelShown = kiru.computed(
  () => componentInfoPanels.value.length > 0
)

/** Widget stack: last-hovered widget is on top. Main menu is always above widgets. */
export type WidgetStackId = "profiler" | "debugger" | "componentInfo"
export const WIDGET_Z_BASE = 50
export const widgetStackTop = kiru.signal<WidgetStackId | null>(null)
