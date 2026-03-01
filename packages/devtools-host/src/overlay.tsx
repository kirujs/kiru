import * as kiru from "kiru"
import { DRAG_SNAP_PADDING } from "./constants"
import {
  createDraggableController,
  DevtoolsApp,
  devtoolsState,
  ifDevtoolsAppRootHasFocus,
  trapFocus,
} from "devtools-shared"
import { hideOverlay, isOverlayShown } from "./state"

interface EmbeddedOverlayProps {
  scale: number
  opacity: number
}

const OVERLAY_POSITION_STORAGE_KEY = "kiru.devtools.overlayPosition"

export const EmbeddedOverlay: Kiru.FC<EmbeddedOverlayProps> = () => {
  const overlayController = createDraggableController({
    storage: sessionStorage,
    key: OVERLAY_POSITION_STORAGE_KEY,
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    allowFloat: true,
    snapDistance: 50,
  })
  const componentSelectionEnabled = kiru.computed(
    () => devtoolsState.componentSelection.value.enabled
  )

  kiru.onMount(() => {
    overlayController.init()

    const handleKeyDown = (e: KeyboardEvent) => {
      const shadowRoot = document.querySelector("kiru-devtools")!.shadowRoot!
      ifDevtoolsAppRootHasFocus((el) => {
        trapFocus(e, el, shadowRoot.activeElement)
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      overlayController.dispose()
      window.removeEventListener("keydown", handleKeyDown)
    }
  })

  return ({ scale, opacity }) => {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onclick={hideOverlay}
          style={{
            opacity:
              isOverlayShown.value && !componentSelectionEnabled.value ? 1 : 0,
            transition: "150ms ease-in-out",
            pointerEvents:
              isOverlayShown.value && !componentSelectionEnabled.value
                ? "auto"
                : "none",
            visibility:
              isOverlayShown.value && !componentSelectionEnabled.value
                ? "visible"
                : "hidden",
          }}
        />
        <div ref={overlayController.containerRef} className="z-50">
          <div
            style={{
              scale,
              opacity: componentSelectionEnabled.value ? 0 : opacity,
              transition: "150ms ease-in-out",
              pointerEvents: componentSelectionEnabled.value ? "none" : "auto",
            }}
            className="rounded-sm z-50 bg-neutral-900/30 hover:bg-neutral-900 border border-white/10"
          >
            <button
              ref={overlayController.handleRef}
              className="w-full bg-white/5 rounded py-1 px-2 text-left cursor-grab active:cursor-grabbing"
            >
              Overlay
            </button>
            <div className="p-2">
              <DevtoolsApp />
            </div>
          </div>
        </div>
      </>
    )
  }
}
