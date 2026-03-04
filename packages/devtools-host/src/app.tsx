import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  createDraggableController,
  FlameIcon,
  clamp,
  GaugeIcon,
  MouseIcon,
  RadioIcon,
} from "devtools-shared"
import {
  isComponentInfoPanelShown,
  isComponentSelectorEnabled,
  isDebuggerShown,
  isProfilerShown,
} from "./state"
import { DRAG_SNAP_PADDING, HANDLE_TOOLTIP_GAP } from "./constants"
import {
  ComponentInfoWidget,
  ComponentSelectorWidget,
  DebuggerWidget,
  ProfilingWidget,
} from "./widgets"
const MENU_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"

const mounted = kiru.signal(false)
const showTooltipMenu = kiru.signal(false)
const tooltipRef = kiru.ref<HTMLDivElement>(null)

const containerOpacity = kiru.computed(() => {
  return mounted.value ? 1 : 0
})

export default function DevtoolsHostApp() {
  const mainMenuController = createDraggableController({
    storage: localStorage,
    key: MENU_POSITION_STORAGE_KEY,
    defaultPosition: { type: "snapped", side: "bottom", percent: 0.5 },
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    onclick: () => (showTooltipMenu.value = !showTooltipMenu.value),
  })

  const tooltipFlexDirection = kiru.computed(() => {
    const snapSide = mainMenuController.snapSide.value
    return snapSide === "left" || snapSide === "right" ? "column" : "row"
  })

  const containerFlexDirection = kiru.computed(() => {
    const snapSide = mainMenuController.snapSide.value
    return snapSide === "left" || snapSide === "right" ? "row" : "column"
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
        const handleEl = mainMenuController.handleRef.value
        const handleW = handleEl?.offsetWidth ?? 0
        const handleH = handleEl?.offsetHeight ?? 0

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

        // Slide so there is always HANDLE_TOOLTIP_GAP between handle edge and tooltip edge.
        const offsetX = handleW / 2 + HANDLE_TOOLTIP_GAP + tooltipWidth / 2
        const offsetY = handleH / 2 + HANDLE_TOOLTIP_GAP + tooltipHeight / 2
        let slideX = 0
        let slideY = 0
        if (snapSide === "left") slideX = show ? offsetX : -offsetX
        else if (snapSide === "right") slideX = show ? -offsetX : offsetX
        else if (snapSide === "top")
          slideY = show ? offsetY : -offsetY // tooltip below handle
        else slideY = show ? -offsetY : offsetY // bottom: tooltip above handle

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
            opacity: containerOpacity,
            flexDirection: containerFlexDirection,
          }}
          className={`z-999999 top-0 left-0 flex items-center justify-center`}
        >
          <button
            ref={mainMenuController.handleRef}
            className="rounded-full p-2 z-10"
            style={{
              background:
                "linear-gradient(135deg, rgb(143 1 1 / 90%) 0%, rgba(119, 14, 103, 0.89) 75%)",
            }}
          >
            <FlameIcon className="w-5 h-5" />
          </button>
          <div
            ref={tooltipRef}
            style={{
              transition: "80ms ease-in-out",
              transformOrigin: "0 0",
              flexDirection: tooltipFlexDirection,
            }}
            className={cls(
              `absolute left-1/2 top-1/2 z-0 flex p-1 gap-1`,
              "bg-neutral-900 rounded-xl shadow-sm"
            )}
          >
            <TooltipMenuButton
              active={isProfilerShown}
              title="Toggle Profiler"
              onclick={() => (isProfilerShown.value = !isProfilerShown.value)}
            >
              <GaugeIcon className="w-4 h-4 pointer-events-none" />
              <small>Profiler</small>
            </TooltipMenuButton>
            <TooltipMenuButton
              active={isDebuggerShown}
              title="Toggle Debugger"
              onclick={() => (isDebuggerShown.value = !isDebuggerShown.value)}
            >
              <RadioIcon className="w-4 h-4 pointer-events-none" />
              <small>Tracking</small>
            </TooltipMenuButton>
            <TooltipMenuButton
              active={isComponentSelectorEnabled}
              title="Select Component"
              onclick={() => {
                isComponentSelectorEnabled.value =
                  !isComponentSelectorEnabled.value
              }}
            >
              <MouseIcon className="w-4 h-4 pointer-events-none" />
              <small>Inspect</small>
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
        <kiru.Transition
          in={isComponentSelectorEnabled}
          duration={{
            in: 0,
            out: 150,
          }}
          element={(state) => {
            if (state === "exited") return null
            return <ComponentSelectorWidget state={state} />
          }}
        />
        <kiru.Transition
          in={isComponentInfoPanelShown}
          duration={{
            in: 0,
            out: 150,
          }}
          element={(state) => {
            if (state === "exited") return null
            return <ComponentInfoWidget state={state} />
          }}
        />
      </>
    )
  }
}

interface TooltipMenuButtonProps extends kiru.ElementProps<"button"> {
  active?: kiru.Signal<boolean>
}

const TooltipMenuButton: Kiru.FC<TooltipMenuButtonProps> = () => {
  const { derive } = kiru.setup<TooltipMenuButtonProps>()

  const $class = derive(({ className, active }) => {
    const isActive = !!active?.value
    return cls(
      "flex items-center px-1.5 py-0.5 gap-2",
      "text-sm rounded-lg border border-white/10",
      isActive
        ? "text-neutral-100"
        : "bg-white/2.5 hover:bg-white/5 text-neutral-400",
      "transition-colors duration-150",
      kiru.unwrap(className, true)
    )
  })

  const background = derive(({ active }) => {
    const isActive = !!active?.value
    return isActive
      ? "linear-gradient(135deg, rgb(143 1 1 / 75%) 0%, rgba(119, 14, 103, 0.89) 65%)"
      : "transparent"
  })

  return ({ className, active, ...props }: TooltipMenuButtonProps) => {
    return <button className={$class} style={{ background }} {...props} />
  }
}
