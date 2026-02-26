import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  assert,
  ComponentIcon,
  ExpandIcon,
  FlameIcon,
  GaugeIcon,
  GripIcon,
  ProfilingTabView,
} from "devtools-shared"

type Vec2 = [x: number, y: number]

interface DraggableControllerConfig {
  onclick?: () => void
  storageKey: string
}
const MENU_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"
const OVERLAY_POSITION_STORAGE_KEY = "kiru.devtools.overlayPosition"

const MENU_PADDING = 10
const MIN_MENU_CORNER_DIST = 50
type SnapSide = "top" | "right" | "bottom" | "left"
interface DraggablePositionInfo {
  percent: number
  snapSide: SnapSide
}

const loadDraggablePosFromStorage = (key: string): DraggablePositionInfo => {
  const posStr = localStorage.getItem(key)
  if (posStr) {
    try {
      const parsed = JSON.parse(posStr)
      assert(
        ["top", "right", "bottom", "left"].includes(parsed.snapSide),
        "invalid snapSide"
      )
      assert(
        typeof parsed.percent === "number" &&
          parsed.percent >= 0 &&
          parsed.percent <= 1,
        "invalid percent"
      )
      return parsed
    } catch {}
  }
  const info: DraggablePositionInfo = {
    percent: 0.5,
    snapSide: "bottom",
  }
  localStorage.setItem(key, JSON.stringify(info))
  return info
}
const createDraggableController = (config: DraggableControllerConfig) => {
  const cleanups: (() => void)[] = []
  const dispose = () => cleanups.forEach((c) => c())

  const { percent: initialPercent, snapSide: initialSnapSide } =
    loadDraggablePosFromStorage(config.storageKey)

  const containerRef = kiru.signal<HTMLDivElement | null>(null)
  const handleRef = kiru.signal<HTMLButtonElement | null>(null)

  const percent = kiru.signal(initialPercent)
  const snapSide = kiru.signal(initialSnapSide)
  const containerPos = kiru.signal<Vec2>([0, 0])

  cleanups.push(
    containerPos.subscribe(([x, y]) => {
      const container = containerRef.value!
      container.style.transform = `translate(${x}px, ${y}px)`
    })
  )

  cleanups.push(() => {
    ;[containerRef, handleRef, percent, snapSide, containerPos].forEach((s) => {
      kiru.Signal.dispose(s)
    })
  })

  const handleBtnMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return

    const handle = handleRef.value!
    const [initialX, initialY]: Vec2 = [e.clientX, e.clientY]
    const initialHandleRect = handle.getBoundingClientRect()
    const [initialOffsetX, initialOffsetY]: Vec2 = [
      initialX - initialHandleRect.left,
      initialY - initialHandleRect.top,
    ]
    let dragging = false
    const handleMouseMove = (e: MouseEvent) => {
      // once our delta is greater than 5px, we start dragging
      if (
        !dragging &&
        (Math.abs(e.clientX - initialX) > 5 ||
          Math.abs(e.clientY - initialY) > 5)
      ) {
        dragging = true
      }

      if (!dragging) return

      const [currentX, currentY]: Vec2 = [
        e.clientX - initialOffsetX,
        e.clientY - initialOffsetY,
      ]
      const currentXPercent = currentX / window.innerWidth
      const currentYPercent = currentY / window.innerHeight

      const SECTION_SIZE_LARGE = 0.5
      const SECTION_SIZE_SMALL = 0.25
      const isLandscape = window.innerWidth > window.innerHeight
      if (isLandscape) {
        const topSectorMax = SECTION_SIZE_LARGE
        const bottomSectorMin = SECTION_SIZE_LARGE
        const leftSectorMax = SECTION_SIZE_SMALL
        const rightSectorMin = 1 - SECTION_SIZE_SMALL

        if (currentXPercent < leftSectorMax) {
          snapSide.value = "left"
          percent.value = currentYPercent
        } else if (currentXPercent > rightSectorMin) {
          snapSide.value = "right"
          percent.value = currentYPercent
        } else if (currentYPercent < topSectorMax) {
          snapSide.value = "top"
          percent.value = currentXPercent
        } else if (currentYPercent > bottomSectorMin) {
          snapSide.value = "bottom"
          percent.value = currentXPercent
        }
      } else {
        const topSectorMax = SECTION_SIZE_SMALL
        const bottomSectorMin = 1 - SECTION_SIZE_SMALL
        const leftSectorMax = SECTION_SIZE_LARGE
        const rightSectorMin = SECTION_SIZE_LARGE

        if (currentYPercent < topSectorMax) {
          snapSide.value = "top"
          percent.value = currentXPercent
        } else if (currentYPercent > bottomSectorMin) {
          snapSide.value = "bottom"
          percent.value = currentXPercent
        } else if (currentXPercent < leftSectorMax) {
          snapSide.value = "left"
          percent.value = currentYPercent
        } else if (currentXPercent > rightSectorMin) {
          snapSide.value = "right"
          percent.value = currentYPercent
        }
      }
      calculatePosition()
    }

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)

      if (!dragging) return config.onclick?.()

      localStorage.setItem(
        config.storageKey,
        JSON.stringify({ percent: percent.value, snapSide: snapSide.value })
      )
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  const calculatePosition = () => {
    const handle = handleRef.value!
    let transformX = 0
    let transformY = 0
    switch (snapSide.value) {
      case "top":
        transformY = 0
        transformX = percent.value
        break
      case "bottom":
        transformY = 100
        transformX = percent.value
        break
      case "left":
        transformY = percent.value
        transformX = 0
        break
      case "right":
        transformY = percent.value
        transformX = 100
        break
    }
    const handleRect = handle.getBoundingClientRect()
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max)

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const isHorizontal = snapSide.value === "top" || snapSide.value === "bottom"

    const xPad = isHorizontal ? MIN_MENU_CORNER_DIST : MENU_PADDING
    const finalX = clamp(
      transformX * windowWidth,
      xPad,
      windowWidth - xPad - handleRect.width
    )
    const finalY = clamp(
      transformY * windowHeight,
      MENU_PADDING,
      windowHeight - MENU_PADDING - handleRect.height
    )
    containerPos.value = [finalX, finalY]
  }

  kiru.onBeforeMount(() => {
    calculatePosition()
    window.addEventListener("resize", calculatePosition)
    handleRef.value!.addEventListener("mousedown", handleBtnMouseDown)
    return () => {
      window.removeEventListener("resize", calculatePosition)
      handleRef.value!.removeEventListener("mousedown", handleBtnMouseDown)
    }
  })

  return { handleRef, containerRef, snapSide, dispose }
}

const mounted = kiru.signal(false)
const showTooltipMenu = kiru.signal(false)
const tooltipRef = kiru.ref<HTMLDivElement>(null)

const isOverlayShown = kiru.signal(false)
const toggleOverlayShown = () => (isOverlayShown.value = !isOverlayShown.value)

export default function DevtoolsHostApp() {
  const mainMenuController = createDraggableController({
    storageKey: MENU_POSITION_STORAGE_KEY,
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
    storageKey: OVERLAY_POSITION_STORAGE_KEY,
  })
  return () => (
    <div
      ref={overlayController.containerRef}
      className="p-2 fixed top-0 left-0 rounded z-50 bg-neutral-900/30 hover:bg-neutral-900 border border-white/5"
    >
      <button
        ref={overlayController.handleRef}
        className="bg-crimson rounded-full p-2 z-10"
      >
        <FlameIcon />
      </button>
      <ProfilingTabView />
    </div>
  )
}
