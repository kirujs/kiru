import * as kiru from "kiru"

export const isOverlayShown = kiru.signal(false)
export const toggleOverlayShown = () => {
  isOverlayShown.set(!isOverlayShown())
}
export const hideOverlay = () => {
  isOverlayShown.set(false)
}

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
  pulseGeneration: number
}

/** All open component info panels. */
export const componentInfoPanels = kiru.signal<ComponentInfoPanelState[]>([])

export const isComponentInfoPanelShown = kiru.computed(
  () => componentInfoPanels().length > 0
)

/** Widget stack: last-hovered widget is on top. Main menu is always above widgets. */
export type WidgetStackId = "profiler" | "debugger" | "componentInfo"
export const WIDGET_Z_BASE = 50
export const widgetStackTop = kiru.signal<WidgetStackId | null>(null)
