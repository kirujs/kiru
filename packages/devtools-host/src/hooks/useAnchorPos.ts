import {
  useCallback,
  useComputed,
  useLayoutEffect,
  useMemo,
  useRef,
  useSignal,
  useWatch,
} from "kiru"
import { LOCAL_KEY, PADDING } from "../utils/constants"
import { SnapSide, Storage } from "../utils/types"
import { reinitializeAnchorPos } from "../utils"
import { useElementBounding, useEventListener, useMouse } from "devtools-shared"

export const useAnchorPos = () => {
  const { mouse } = useMouse()
  const startMouse = useSignal<null | { x: number; y: number }>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const viewPortRef = useRef<HTMLDivElement>(null)
  const elementBound = useElementBounding(anchorRef)
  const lastDroppedCoord = useSignal({ x: -PADDING, y: -PADDING })
  const anchorCoords = useSignal({ x: -PADDING, y: -PADDING })
  const viewportSize = useSignal({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const snapSide = useSignal<SnapSide>("bottom")
  const timeoutRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const resultString = localStorage.getItem(LOCAL_KEY)
    if (resultString == null) return

    const result: Storage = JSON.parse(resultString)

    viewportSize.value.width = window.innerWidth
    viewportSize.value.height = window.innerHeight
    snapSide.value = result.snapSide

    anchorCoords.value = reinitializeAnchorPos(
      result,
      viewPortRef,
      elementBound
    )
  }, [
    Math.round(elementBound.width.value),
    Math.round(elementBound.height.value),
  ])

  const distanceCovered = useComputed(() => {
    const { x, y } = mouse.value
    if (startMouse.value === null) return null
    const { x: startX, y: startY } = startMouse.value
    return {
      x: x - startX,
      y: y - startY,
    }
  })

  useEventListener(
    "dragstart",
    (e) => {
      e.preventDefault()
      startMouse.value = { x: e.x, y: e.y }
      lastDroppedCoord.value = anchorCoords.value
    },
    {
      ref: () => anchorRef.current,
    }
  )

  useEventListener("mouseup", () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (startMouse.peek()) {
      startMouse.value = null
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          ...anchorCoords.value,
          ...viewportSize.value,
          snapSide: snapSide.value,
        })
      )
    }
  })

  const updateAnchorPos = useCallback(() => {
    if (viewPortRef.current == null) return

    const viewportWidth = viewPortRef.current.offsetWidth

    if (snapSide.value === "right") {
      const min = Math.min(-PADDING, anchorCoords.value.y)
      anchorCoords.value = {
        x: -PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }
    } else if (snapSide.value === "left") {
      const min = Math.min(0, anchorCoords.value.y)
      anchorCoords.value = {
        x: (viewportWidth - elementBound.width.value) * -1 + PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }
    } else if (snapSide.value === "top") {
      const min = Math.min(-PADDING, anchorCoords.value.x)
      anchorCoords.value = {
        x: Math.max(
          min,
          (viewportWidth - elementBound.width.value) * -1 + PADDING
        ),
        y: (window.innerHeight - elementBound.height.value) * -1 + PADDING,
      }

      return
    } else {
      const min = Math.min(-PADDING, anchorCoords.value.x)
      anchorCoords.value = {
        x: Math.max(
          min,
          (viewportWidth - elementBound.width.value) * -1 + PADDING
        ),
        y: -PADDING,
      }
    }
  }, [])

  useWatch([distanceCovered, mouse], (dist, mouse) => {
    if (dist === null || !viewPortRef.current) return

    const { x, y } = mouse
    const viewportWidth = viewPortRef.current.offsetWidth
    const isInBottomSeg = y >= window.innerHeight - 100
    const isInTopSeg = y <= 100
    const isInMidSeg = !isInTopSeg && !isInBottomSeg

    if (isInMidSeg) {
      const isRight = x > window.innerWidth / 2
      snapSide.value = isRight ? "right" : "left"
    } else {
      snapSide.value = isInTopSeg ? "top" : "bottom"
    }
    if (snapSide.value === "right") {
      const min = Math.min(-PADDING, lastDroppedCoord.value.y + dist.y)
      anchorCoords.value = {
        x: -PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }
      return
    } else if (snapSide.value === "left") {
      const min = Math.min(0, lastDroppedCoord.value.y + dist.y)
      anchorCoords.value = {
        x: (viewportWidth - elementBound.width.value) * -1 + PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }

      return
    } else if (snapSide.value === "top") {
      const min = Math.min(-PADDING, lastDroppedCoord.value.x + dist.x)
      anchorCoords.value = {
        x: Math.max(
          min,
          (viewportWidth - elementBound.width.value) * -1 + PADDING
        ),
        y: (window.innerHeight - elementBound.height.value) * -1 + PADDING,
      }

      return
    }

    const min = Math.min(-PADDING, lastDroppedCoord.value.x + dist.x)
    anchorCoords.value = {
      y: -PADDING,
      x: Math.max(
        min,
        (viewportWidth - elementBound.width.value) * -1 + PADDING
      ),
    }
  })

  const onResize = useCallback(() => {
    if (viewPortRef.current === null) return

    anchorCoords.value = reinitializeAnchorPos(
      {
        width: viewportSize.value.width,
        height: viewportSize.value.height,
        x: anchorCoords.value.x,
        y: anchorCoords.value.y,
        snapSide: snapSide.value,
      },
      viewPortRef,
      elementBound
    )

    viewportSize.value.width = window.innerWidth
    viewportSize.value.height = window.innerHeight

    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        ...anchorCoords.value,
        ...viewportSize.value,
        snapSide: snapSide.value,
      })
    )
  }, [
    Math.round(elementBound.width.value),
    Math.round(elementBound.height.value),
  ])
  useEventListener("resize", onResize)

  return {
    anchorRef,
    anchorCoords,
    viewPortRef,
    startMouse,
    elementBound,
    snapSide,
    updateAnchorPos,
  }
}
