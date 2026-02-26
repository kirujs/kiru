import * as kiru from "kiru"
import { assert } from "./utils"

type Vec2 = [x: number, y: number]

type SnapSide = "top" | "right" | "bottom" | "left"
type DraggablePositionInfo =
  | { type: "snapped"; side: SnapSide; percent: number }
  | { type: "floating"; x: number; y: number }

interface DraggableControllerConfig {
  onclick?: () => void
  storage: Storage
  key: string
  getPadding: (snapSide: SnapSide | null) => Vec2
  getDraggableBounds: () => Vec2
  allowFloat?: boolean
  snapDistance?: number
}

interface DraggableController {
  handleRef: kiru.Signal<HTMLButtonElement | null>
  containerRef: kiru.Signal<HTMLDivElement | null>
  snapSide: kiru.Signal<SnapSide | null>
  dispose: () => void
  init: () => void
}

export function createDraggableController(
  config: DraggableControllerConfig
): DraggableController {
  const cleanups: (() => void)[] = []
  const dispose = () => cleanups.forEach((c) => c())

  const containerRef = kiru.signal<HTMLDivElement | null>(null)
  const handleRef = kiru.signal<HTMLButtonElement | null>(null)

  const position = kiru.signal<DraggablePositionInfo>(
    loadDraggablePosFromStorage(config.storage, config.key)
  )
  const snapSide = kiru.computed<SnapSide | null>(() =>
    position.value.type === "snapped" ? position.value.side : null
  )
  const containerPos = kiru.signal<Vec2>([0, 0])

  cleanups.push(
    containerPos.subscribe(([x, y]) => {
      const container = containerRef.value!
      container.style.transform = `translate(${x}px, ${y}px)`
    })
  )

  cleanups.push(() => {
    ;[containerRef, handleRef, position, snapSide, containerPos].forEach((s) =>
      kiru.Signal.dispose(s)
    )
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

      const centerX = currentX + containerW / 2
      const centerY = currentY + containerH / 2

      if (config.allowFloat && minDist > (config.snapDistance ?? 0)) {
        position.value = {
          type: "floating",
          x: centerX / boundsW,
          y: centerY / boundsH,
        }
      } else if (minDist === distLeft) {
        position.value = {
          type: "snapped",
          side: "left",
          percent: centerY / boundsH,
        }
      } else if (minDist === distRight) {
        position.value = {
          type: "snapped",
          side: "right",
          percent: centerY / boundsH,
        }
      } else if (minDist === distTop) {
        position.value = {
          type: "snapped",
          side: "top",
          percent: centerX / boundsW,
        }
      } else {
        position.value = {
          type: "snapped",
          side: "bottom",
          percent: centerX / boundsW,
        }
      }
      calculatePosition()
    }

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)

      if (!dragging) return config.onclick?.()

      config.storage.setItem(config.key, JSON.stringify(position.value))
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const calculatePosition = () => {
    const container = containerRef.value!
    const { width: containerW, height: containerH } =
      container.getBoundingClientRect()

    const [boundsW, boundsH] = config.getDraggableBounds()
    const pos = position.value

    if (pos.type === "floating") {
      const [xPad, yPad] = config.getPadding(null)
      containerPos.value = [
        clamp(
          pos.x * boundsW - containerW / 2,
          xPad,
          boundsW - xPad - containerW
        ),
        clamp(
          pos.y * boundsH - containerH / 2,
          yPad,
          boundsH - yPad - containerH
        ),
      ]
      return
    }

    const [xPad, yPad] = config.getPadding(pos.side)
    let targetX = 0
    let targetY = 0
    switch (pos.side) {
      case "top":
        targetX = pos.percent * boundsW - containerW / 2
        targetY = 0
        break
      case "bottom":
        targetX = pos.percent * boundsW - containerW / 2
        targetY = Infinity
        break
      case "left":
        targetX = 0
        targetY = pos.percent * boundsH - containerH / 2
        break
      case "right":
        targetX = Infinity
        targetY = pos.percent * boundsH - containerH / 2
        break
    }

    containerPos.value = [
      clamp(targetX, xPad, boundsW - xPad - containerW),
      clamp(targetY, yPad, boundsH - yPad - containerH),
    ]
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
      if (parsed.type === "snapped") {
        assert(
          ["top", "right", "bottom", "left"].includes(parsed.side),
          "invalid side"
        )
        assert(
          typeof parsed.percent === "number" &&
            parsed.percent >= 0 &&
            parsed.percent <= 1,
          "invalid percent"
        )
        return parsed as DraggablePositionInfo
      }
      if (parsed.type === "floating") {
        assert(
          typeof parsed.x === "number" && parsed.x >= 0 && parsed.x <= 1,
          "invalid x"
        )
        assert(
          typeof parsed.y === "number" && parsed.y >= 0 && parsed.y <= 1,
          "invalid y"
        )
        return parsed as DraggablePositionInfo
      }
    } catch {}
  }
  const info: DraggablePositionInfo = {
    type: "snapped",
    side: "bottom",
    percent: 0.5,
  }
  storage.setItem(key, JSON.stringify(info))
  return info
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
