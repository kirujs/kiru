import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  createDraggableController,
  FlameIcon,
  clamp,
  GaugeIcon,
  ZapIcon,
} from "devtools-shared"
import { ComponentSelectorOverlay } from "./component-selector-overlay"
import { isDebuggerShown, isProfilerShown } from "./state"
import { DRAG_SNAP_PADDING } from "./constants"
import { DebuggerWidget, ProfilingWidget } from "./widgets"
const MENU_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"

const mounted = kiru.signal(false)
const showTooltipMenu = kiru.signal(false)
const tooltipRef = kiru.ref<HTMLDivElement>(null)

export default function DevtoolsHostApp() {
  const mainMenuController = createDraggableController({
    storage: localStorage,
    key: MENU_POSITION_STORAGE_KEY,
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
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
    const container = mainMenuController.containerRef.value!
    const tooltip = tooltipRef.current!
    kiru.effect(
      [
        showTooltipMenu,
        mainMenuController.snapSide,
        mainMenuController.containerPos,
      ],
      (show, snapSide, [containerX, containerY]) => {
        const [tooltipWidth, tooltipHeight] = [
          tooltip.offsetWidth,
          tooltip.offsetHeight,
        ]

        // left-1/2 top-1/2 places the tooltip's top-left at the container's center.
        // Subtracting half the tooltip's own size recenters it on the container.
        // The clamp delta shifts it only when near a viewport edge (zero otherwise).
        // Uses containerPos (target coords) not getBoundingClientRect() to avoid
        // reading a mid-transition visual position due to the CSS transition.
        let clampDeltaX = 0
        let clampDeltaY = 0
        if (snapSide === "top" || snapSide === "bottom") {
          const idealLeft =
            containerX + container.offsetWidth / 2 - tooltipWidth / 2
          const clampedLeft = clamp(
            idealLeft,
            DRAG_SNAP_PADDING,
            window.innerWidth - DRAG_SNAP_PADDING - tooltipWidth
          )
          clampDeltaX = clampedLeft - idealLeft
        } else {
          const idealTop =
            containerY + container.offsetHeight / 2 - tooltipHeight / 2
          const clampedTop = clamp(
            idealTop,
            DRAG_SNAP_PADDING,
            window.innerHeight - DRAG_SNAP_PADDING - tooltipHeight
          )
          clampDeltaY = clampedTop - idealTop
        }

        // Slide offset along the snap axis.
        const offsetSize =
          Math.min(tooltipWidth, tooltipHeight) + DRAG_SNAP_PADDING
        let slideX = 0
        let slideY = 0
        if (snapSide === "left") slideX = show ? offsetSize : -offsetSize
        else if (snapSide === "right") slideX = show ? -offsetSize : offsetSize
        else if (snapSide === "top") slideY = show ? offsetSize : -offsetSize
        else slideY = show ? -offsetSize : offsetSize

        const translateX = -tooltipWidth / 2 + clampDeltaX + slideX
        const translateY = -tooltipHeight / 2 + clampDeltaY + slideY
        tooltip.style.transform = `scale(${
          show ? 1 : 0
        }) translate(${translateX}px, ${translateY}px)`

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
          className={`flex ${containerFlexDirection} items-center justify-center z-50`}
        >
          <button
            ref={mainMenuController.handleRef}
            className="bg-crimson rounded-full p-2 z-10"
          >
            <FlameIcon />
          </button>
          <div
            ref={tooltipRef}
            style="transition: 80ms ease-in-out; transform-origin: 0 0"
            className={cls(
              `absolute left-1/2 top-1/2 z-0 flex ${tooltipFlexDirection} p-1.5 gap-1.5`,
              "bg-neutral-900 border border-crimson/50 rounded-xl shadow"
            )}
          >
            <TooltipMenuButton
              title="Toggle Profiler"
              onclick={() => (isProfilerShown.value = !isProfilerShown.value)}
            >
              <GaugeIcon className="w-4 h-4 pointer-events-none" />
            </TooltipMenuButton>
            <TooltipMenuButton
              title="Toggle Debugger"
              onclick={() => (isDebuggerShown.value = !isDebuggerShown.value)}
            >
              <ZapIcon className="w-4 h-4 pointer-events-none" />
            </TooltipMenuButton>
          </div>
        </div>
        <kiru.Transition
          in={isProfilerShown}
          duration={{
            in: 0,
            out: 150,
          }}
          element={(state) => {
            if (state === "exited") return null
            return <ProfilingWidget state={state} />
          }}
        />
        <kiru.Transition
          in={isDebuggerShown}
          duration={{
            in: 0,
            out: 150,
          }}
          element={(state) => {
            if (state === "exited") return null
            return <DebuggerWidget state={state} />
          }}
        />
        <ComponentSelectorOverlay />
      </>
    )
  }
}

interface TooltipMenuButtonProps extends kiru.ElementProps<"button"> {
  active?: boolean
}

function TooltipMenuButton({
  className,
  active = false,
  ...props
}: TooltipMenuButtonProps) {
  return (
    <button
      className={cls(
        "flex items-center px-2 py-1 gap-2",
        "text-xs rounded border border-white border-opacity-10 bg-white/5 hover:bg-white/10",
        active && "bg-white bg-opacity-15 text-neutral-100",
        kiru.unwrap(className)
      )}
      {...props}
    />
  )
}

// window.__kiru.devtools?.debugger.subscribe((trackedSignals) => {
//   console.log("trackedSignals", trackedSignals)
// })
