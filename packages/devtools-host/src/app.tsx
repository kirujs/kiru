import * as Kiru from "kiru"
import { assert, FlameIcon } from "devtools-shared"

type Vec2 = [x: number, y: number]

interface ButtonControllerConfig {
  onclick: () => void
}
const BUTTON_POSITION_STORAGE_KEY = "kiru.devtools.anchorPosition"
type SnapSide = "top" | "right" | "bottom" | "left"
interface PositionStorageInfo {
  percent: number
  snapSide: SnapSide
}

const loadPosFromStorage = (): PositionStorageInfo => {
  const posStr = localStorage.getItem(BUTTON_POSITION_STORAGE_KEY)
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
  localStorage.setItem(BUTTON_POSITION_STORAGE_KEY, JSON.stringify(info))
  return info
}
const createButtonController = (config: ButtonControllerConfig) => {
  const { percent: initialPercent, snapSide: initialSnapSide } =
    loadPosFromStorage()

  const btnRef = Kiru.ref<HTMLButtonElement>(null)
  const percent = Kiru.signal(initialPercent)
  const snapSide = Kiru.signal(initialSnapSide)

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return

    const btn = btnRef.current!
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
      console.log({ currentXPercent, currentYPercent })

      const isLandscape = window.innerWidth > window.innerHeight
      if (isLandscape) {
        const topSectorMax = 0.5
        const bottomSectorMin = 0.5
        const leftSectorMax = 0.15
        const rightSectorMin = 0.85

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
        const topSectorMax = 0.15
        const bottomSectorMin = 0.85
        const leftSectorMax = 0.5
        const rightSectorMin = 0.5

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
      applyButtonPosition(btn)
    }

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)

      if (!dragging) return config.onclick()

      localStorage.setItem(
        BUTTON_POSITION_STORAGE_KEY,
        JSON.stringify({ percent: percent.value, snapSide: snapSide.value })
      )
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    //window.addEventListener("mouseleave", handleMouseUp)
  }

  const applyButtonPosition = (btn: HTMLButtonElement) => {
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
    const finalX = clamp(
      transformX * windowWidth,
      10,
      windowWidth - 10 - btnRect.width
    )
    const finalY = clamp(
      transformY * windowHeight,
      10,
      windowHeight - 10 - btnRect.height
    )
    btn.style.transform = `translate(${finalX}px, ${finalY}px)`
  }

  Kiru.onBeforeMount(() => {
    const btn = btnRef.current!
    btn.style.position = "fixed"
    btn.style.top = "0"
    btn.style.left = "0"
    btn.style.zIndex = "9999999"
    btn.style.transition = "transform 80ms"

    applyButtonPosition(btn)
    window.addEventListener("resize", () => applyButtonPosition(btn))
    btn.addEventListener("mousedown", handleMouseDown)
  })

  return { ref: btnRef }
}

export default function DevtoolsHostApp() {
  const btnController = createButtonController({
    onclick: () => {},
  })

  return () => (
    <button ref={btnController.ref} className="bg-crimson rounded-full p-2">
      <FlameIcon />
    </button>
  )
}
