import * as kiru from "kiru"
import { assert } from "./utils"

type Vec2 = [x: number, y: number]

type SnapSide = "top" | "right" | "bottom" | "left"
interface DraggablePositionInfo {
  percent: number
  snapSide: SnapSide
}

interface DraggableControllerConfig {
  onclick?: () => void
  storage: Storage
  key: string
  getPadding: (snapSide: SnapSide) => Vec2
  getDraggableBounds: () => Vec2
}

interface DraggableController {
  handleRef: kiru.Signal<HTMLButtonElement | null>
  containerRef: kiru.Signal<HTMLDivElement | null>
  snapSide: kiru.Signal<SnapSide>
  dispose: () => void
  init: () => void
}

export function createDraggableController(
  config: DraggableControllerConfig
): DraggableController {
  const cleanups: (() => void)[] = []
  const dispose = () => cleanups.forEach((c) => c())

  const { percent: initialPercent, snapSide: initialSnapSide } =
    loadDraggablePosFromStorage(config.storage, config.key)

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

  const onHandleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return

    const container = containerRef.value!
    const [initialX, initialY] = [e.clientX, e.clientY]
    const initialContainerRect = container.getBoundingClientRect()
    const [initialOffsetX, initialOffsetY] = [
      initialX - initialContainerRect.left,
      initialY - initialContainerRect.top,
    ]
    let dragging = false
    const onMouseMove = (e: MouseEvent) => {
      // once our delta is greater than 5px, we start dragging
      if (
        !dragging &&
        (Math.abs(e.clientX - initialX) > 5 ||
          Math.abs(e.clientY - initialY) > 5)
      ) {
        dragging = true
      }

      if (!dragging) return

      const [currentX, currentY] = [
        e.clientX - initialOffsetX,
        e.clientY - initialOffsetY,
      ]
      const [boundsW, boundsH] = config.getDraggableBounds()
      const { width: containerW, height: containerH } =
        container.getBoundingClientRect()

      const distLeft = currentX
      const distRight = boundsW - (currentX + containerW)
      const distTop = currentY
      const distBottom = boundsH - (currentY + containerH)

      const minDist = Math.min(distLeft, distRight, distTop, distBottom)
      if (minDist === distLeft) {
        snapSide.value = "left"
        percent.value = currentY / boundsH
      } else if (minDist === distRight) {
        snapSide.value = "right"
        percent.value = currentY / boundsH
      } else if (minDist === distTop) {
        snapSide.value = "top"
        percent.value = currentX / boundsW
      } else {
        snapSide.value = "bottom"
        percent.value = currentX / boundsW
      }
      calculatePosition()
    }

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)

      if (!dragging) return config.onclick?.()

      config.storage.setItem(
        config.key,
        JSON.stringify({ percent: percent.value, snapSide: snapSide.value })
      )
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const calculatePosition = () => {
    const container = containerRef.value!
    const containerRect = container.getBoundingClientRect()
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max)

    const [boundsW, boundsH] = config.getDraggableBounds()

    let targetX = 0
    let targetY = 0
    switch (snapSide.value) {
      case "top":
        targetX = percent.value * boundsW
        targetY = 0
        break
      case "bottom":
        targetX = percent.value * boundsW
        targetY = Infinity
        break
      case "left":
        targetX = 0
        targetY = percent.value * boundsH
        break
      case "right":
        targetX = Infinity
        targetY = percent.value * boundsH
        break
    }

    const [xPad, yPad] = config.getPadding(snapSide.value)

    const finalX = clamp(targetX, xPad, boundsW - xPad - containerRect.width)
    const finalY = clamp(targetY, yPad, boundsH - yPad - containerRect.height)
    containerPos.value = [finalX, finalY]
  }

  const init = () => {
    const handle = handleRef.value!
    const container = containerRef.value!
    if (!handle) return console.error("handle not found", new Error().stack)

    calculatePosition()

    const resizeObserver = new ResizeObserver(calculatePosition)
    resizeObserver.observe(container)

    window.addEventListener("resize", calculatePosition)
    handle.addEventListener("mousedown", onHandleMouseDown)

    cleanups.push(() => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", calculatePosition)
      handle.removeEventListener("mousedown", onHandleMouseDown)
    })
  }

  return { init, handleRef, containerRef, snapSide, dispose }
}

function loadDraggablePosFromStorage(
  storage: Storage,
  key: string
): DraggablePositionInfo {
  const posStr = storage.getItem(key)
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
  storage.setItem(key, JSON.stringify(info))
  return info
}
