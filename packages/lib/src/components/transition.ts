import { useCallback } from "../hooks/useCallback.js"
import { useEffect } from "../hooks/useEffect.js"
import { useLayoutEffect } from "../hooks/useLayoutEffect.js"
import { useRef } from "../hooks/useRef.js"
import { useState } from "../hooks/useState.js"

export type TransitionState = "entering" | "entered" | "exiting" | "exited"
interface TransitionProps {
  in: boolean
  /**
   * Initial state of the transition
   * @default "exited"
   */
  initialState?: "entered" | "exited"
  duration?:
    | number
    | {
        in: number
        out: number
      }
  element: (state: "entering" | "entered" | "exiting" | "exited") => JSX.Element
  onTransitionEnd?: (state: "entered" | "exited") => void
}

export function Transition(props: TransitionProps) {
  const [tState, setTState] = useState<TransitionState>(
    props.initialState || "exited"
  )
  const timeoutRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (props.in && tState !== "entered" && tState !== "entering") {
      setTransitionState("entering")
      queueStateChange("entered")
    } else if (!props.in && tState !== "exited" && tState !== "exiting") {
      setTransitionState("exiting")
      queueStateChange("exited")
    }
  }, [props.in, tState])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const setTransitionState = useCallback((transitionState: TransitionState) => {
    clearTimeout(timeoutRef.current)
    setTState(transitionState)
    if (transitionState === "entered" || transitionState === "exited") {
      if (props.onTransitionEnd) props.onTransitionEnd(transitionState)
    }
  }, [])

  const queueStateChange = useCallback(
    (transitionState: "entered" | "exited") => {
      timeoutRef.current = window.setTimeout(
        () => setTransitionState(transitionState),
        getTiming(transitionState, props.duration)
      )
    },
    [props.duration]
  )

  return props.element(tState)
}

const defaultDuration = 150
function getTiming(
  transitionState: "entered" | "exited",
  duration: TransitionProps["duration"]
): number {
  if (typeof duration === "number") return duration
  switch (transitionState) {
    case "entered":
      return duration?.in ?? defaultDuration
    case "exited":
      return duration?.out ?? defaultDuration
  }
}

function clearTimeout(id: number | null) {
  if (id != null) window.clearTimeout(id)
}
