import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  createDraggableController,
  ExpandIcon,
  FlameIcon,
  ProfilingTabView,
} from "devtools-shared"

const MENU_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"
const OVERLAY_POSITION_STORAGE_KEY = "kiru.devtools.overlayPosition"
const MENU_PADDING = 10

const mounted = kiru.signal(false)
const showTooltipMenu = kiru.signal(false)
const tooltipRef = kiru.ref<HTMLDivElement>(null)

const isOverlayShown = kiru.signal(false)
const toggleOverlayShown = () => (isOverlayShown.value = !isOverlayShown.value)

export default function DevtoolsHostApp() {
  const mainMenuController = createDraggableController({
    storage: localStorage,
    key: MENU_POSITION_STORAGE_KEY,
    getPadding: () => [MENU_PADDING, MENU_PADDING],
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    onclick: () => (showTooltipMenu.value = !showTooltipMenu.value),
  })

  const tooltipFlexDirection = kiru.computed(() => {
    return mainMenuController.snapSide.value === "left" ||
      mainMenuController.snapSide.value === "right"
      ? "flex-col"
      : "flex-row"
  })

  const containerFlexDirection = kiru.computed(() => {
    return mainMenuController.snapSide.value === "left" ||
      mainMenuController.snapSide.value === "right"
      ? "flex-row"
      : "flex-col"
  })

  kiru.onMount(() => {
    mainMenuController.init()
    const tooltip = tooltipRef.current!
    const tooltipSize = tooltip.getBoundingClientRect()
    kiru.effect(
      [showTooltipMenu, mainMenuController.snapSide],
      (show, snapSide) => {
        const offsetSize =
          Math.min(tooltipSize.width, tooltipSize.height) + MENU_PADDING
        let offsetX = 0
        let offsetY = 0

        if (snapSide === "left") {
          offsetX = -offsetSize
          offsetY = 0
        } else if (snapSide === "right") {
          offsetX = offsetSize
          offsetY = 0
        } else if (snapSide === "top") {
          offsetX = 0
          offsetY = -offsetSize
        } else if (snapSide === "bottom") {
          offsetX = 0
          offsetY = offsetSize
        }

        const translateX = show ? -offsetX : offsetX
        const translateY = show ? -offsetY : offsetY

        tooltip.style.transform = `
        scale(${show ? 1 : 0}) 
        translate(${translateX}px, ${translateY}px)
      `

        setTimeout(() => {
          mounted.value = true
        }, 50)
      }
    )
  })

  return () => {
    return (
      <>
        <div
          ref={mainMenuController.containerRef}
          style={{
            transition: "80ms",
            opacity: mounted.value ? 1 : 0,
          }}
          className={`flex ${containerFlexDirection} items-center justify-center fixed top-0 left-0 z-50`}
        >
          <div
            ref={tooltipRef}
            style="transition: 80ms ease-in-out"
            className={cls(
              `absolute z-0 flex ${tooltipFlexDirection} p-2 gap-2`,
              "bg-neutral-900 border-2 border-crimson rounded-full shadow"
            )}
          >
            <button onclick={toggleOverlayShown}>
              <ExpandIcon className="w-4 h-4" />
            </button>
            <button onclick={toggleOverlayShown}>
              <ExpandIcon className="w-4 h-4" />
            </button>
            <button onclick={toggleOverlayShown}>
              <ExpandIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            ref={mainMenuController.handleRef}
            className="bg-crimson rounded-full p-2 z-10"
          >
            <FlameIcon />
          </button>
        </div>
        <kiru.Show when={isOverlayShown}>
          <EmbeddedOverlay />
        </kiru.Show>
      </>
    )
  }
}

function EmbeddedOverlay() {
  const overlayController = createDraggableController({
    storage: sessionStorage,
    key: OVERLAY_POSITION_STORAGE_KEY,
    getPadding: () => [MENU_PADDING, MENU_PADDING],
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    allowFloat: true,
    snapDistance: 50,
  })
  kiru.onBeforeMount(() => overlayController.init())

  return () => (
    <div
      ref={overlayController.containerRef}
      className="fixed top-0 left-0 rounded z-50 bg-neutral-900/30 hover:bg-neutral-900 border border-white/10"
    >
      <button
        ref={overlayController.handleRef}
        className="w-full bg-white/5 rounded py-1"
      >
        Overlay
      </button>
      <div className="p-2">
        <ProfilingTabView />
      </div>
    </div>
  )
}
