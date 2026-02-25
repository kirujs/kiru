import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import { assert, FlameIcon } from "devtools-shared"

type Vec2 = [x: number, y: number]

interface DraggableMenuControllerConfig {
  onclick: () => void
}
const MENU_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"
const MENU_PADDING = 10
const MIN_MENU_CORNER_DIST = 50
type SnapSide = "top" | "right" | "bottom" | "left"
interface PositionStorageInfo {
  percent: number
  snapSide: SnapSide
}

const loadPosFromStorage = (): PositionStorageInfo => {
  const posStr = localStorage.getItem(MENU_POSITION_STORAGE_KEY)
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
  const info: PositionStorageInfo = {
    percent: 0.5,
    snapSide: "bottom",
  }
  localStorage.setItem(MENU_POSITION_STORAGE_KEY, JSON.stringify(info))
  return info
}
const createDraggableMenuController = (
  config: DraggableMenuControllerConfig
) => {
  const { percent: initialPercent, snapSide: initialSnapSide } =
    loadPosFromStorage()

  const containerRef = kiru.signal<HTMLDivElement | null>(null)
  const btnRef = kiru.signal<HTMLButtonElement | null>(null)

  const percent = kiru.signal(initialPercent)
  const snapSide = kiru.signal(initialSnapSide)
  const menuPos = kiru.signal<Vec2>([0, 0])

  const handleBtnMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return

    const btn = btnRef.value!
    const [initialX, initialY]: Vec2 = [e.clientX, e.clientY]
    const initialBtnRect = btn.getBoundingClientRect()
    const [initialOffsetX, initialOffsetY]: Vec2 = [
      initialX - initialBtnRect.left,
      initialY - initialBtnRect.top,
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

      if (!dragging) return config.onclick()

      localStorage.setItem(
        MENU_POSITION_STORAGE_KEY,
        JSON.stringify({ percent: percent.value, snapSide: snapSide.value })
      )
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  const calculatePosition = () => {
    const btn = btnRef.value!
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
    const btnRect = btn.getBoundingClientRect()
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max)

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const isHorizontal = snapSide.value === "top" || snapSide.value === "bottom"

    const xPad = isHorizontal ? MIN_MENU_CORNER_DIST : MENU_PADDING
    const finalX = clamp(
      transformX * windowWidth,
      xPad,
      windowWidth - xPad - btnRect.width
    )
    const finalY = clamp(
      transformY * windowHeight,
      MENU_PADDING,
      windowHeight - MENU_PADDING - btnRect.height
    )
    menuPos.value = [finalX, finalY]
  }

  menuPos.subscribe(([x, y]) => {
    const container = containerRef.value!
    container.style.transform = `translate(${x}px, ${y}px)`
  })

  kiru.onBeforeMount(() => {
    calculatePosition()
    window.addEventListener("resize", calculatePosition)
    btnRef.value!.addEventListener("mousedown", handleBtnMouseDown)
  })

  return { btnRef, containerRef, snapSide }
}

export default function DevtoolsHostApp() {
  const mounted = kiru.signal(false)
  const showTooltipMenu = kiru.signal(false)
  const tooltipRef = kiru.ref<HTMLDivElement>(null)
  const menuController = createDraggableMenuController({
    onclick: () => (showTooltipMenu.value = !showTooltipMenu.value),
  })

  const tooltipFlexDirection = kiru.computed(() => {
    return menuController.snapSide.value === "left" ||
      menuController.snapSide.value === "right"
      ? "flex-col"
      : "flex-row"
  })

  const containerFlexDirection = kiru.computed(() => {
    return menuController.snapSide.value === "left" ||
      menuController.snapSide.value === "right"
      ? "flex-row"
      : "flex-col"
  })

  kiru.onMount(() => {
    const tooltip = tooltipRef.current!
    const tooltipSize = tooltip.getBoundingClientRect()
    kiru.effect(
      [showTooltipMenu, menuController.snapSide],
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
      <div
        ref={menuController.containerRef}
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
          <FlameIcon />
          <FlameIcon />
          <FlameIcon />
        </div>
        <button
          ref={menuController.btnRef}
          className="bg-crimson rounded-full p-2 z-10"
        >
          <FlameIcon />
        </button>
      </div>
    )
  }
}
