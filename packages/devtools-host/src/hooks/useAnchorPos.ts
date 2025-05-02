import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSignal,
} from "kaioken"
import { LOCAL_KEY, PADDING } from "../utils/constants"
import { SnapSide, Storage } from "../utils/types"
import { reinitializeAnchorPos } from "../utils"
import {
  useEffectDeep,
  useElementBounding,
  useEventListener,
  useMouse,
} from "devtools-shared"

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

  const distanceCovered = useMemo(() => {
    if (startMouse.value === null) return null
    const { x, y } = mouse.value
    return {
      x: x - startMouse.value.x,
      y: y - startMouse.value.y,
    }
  }, [startMouse.value, mouse.value])

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
    if (startMouse.value) {
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

  useEffectDeep(() => {
    if (distanceCovered === null || !viewPortRef.current) return

    const { x, y } = mouse.value

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
      const min = Math.min(
        -PADDING,
        lastDroppedCoord.value.y + distanceCovered.y
      )
      anchorCoords.value = {
        x: -PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }
      return
    } else if (snapSide.value === "left") {
      const min = Math.min(0, lastDroppedCoord.value.y + distanceCovered.y)
      anchorCoords.value = {
        x: (viewportWidth - elementBound.width.value) * -1 + PADDING,
        y: Math.max(
          min,
          (window.innerHeight - elementBound.height.value) * -1 + PADDING
        ),
      }

      return
    } else if (snapSide.value === "top") {
      const min = Math.min(
        -PADDING,
        lastDroppedCoord.value.x + distanceCovered.x
      )
      anchorCoords.value = {
        x: Math.max(
          min,
          (viewportWidth - elementBound.width.value) * -1 + PADDING
        ),
        y: (window.innerHeight - elementBound.height.value) * -1 + PADDING,
      }

      return
    }

    const min = Math.min(-PADDING, lastDroppedCoord.value.x + distanceCovered.x)
    anchorCoords.value = {
      y: -PADDING,
      x: Math.max(
        min,
        (viewportWidth - elementBound.width.value) * -1 + PADDING
      ),
    }
  }, [distanceCovered])

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
