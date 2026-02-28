import { onCleanup } from "../hooks/onCleanup.js"
import { signal, Signal } from "../signals/base.js"
import { effect } from "../signals/effect.js"
import { unwrap } from "../signals/utils.js"

export type TransitionState = "entering" | "entered" | "exiting" | "exited"
interface TransitionProps {
  in: boolean | Signal<boolean>
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

export const Transition: Kiru.FC<TransitionProps> = (props) => {
  const tState = signal<TransitionState>(props.initialState || "exited")
  let timeoutRef: number | null = null

  const setTransitionState = (transitionState: TransitionState) => {
    clearTimeout(timeoutRef)
    tState.value = transitionState
    if (transitionState === "entered" || transitionState === "exited") {
      if (props.onTransitionEnd) props.onTransitionEnd(transitionState)
    }
  }

  const queueStateChange = (transitionState: "entered" | "exited") => {
    timeoutRef = window.setTimeout(
      () => setTransitionState(transitionState),
      getTiming(transitionState, props.duration)
    )
  }

  effect(() => {
    const newIn = unwrap(props.in, true)
    const current = tState.peek()
    if (newIn && current !== "entered" && current !== "entering") {
      setTransitionState("entering")
      queueStateChange("entered")
    } else if (!newIn && current !== "exited" && current !== "exiting") {
      setTransitionState("exiting")
      queueStateChange("exited")
    }
  })

  onCleanup(() => clearTimeout(timeoutRef))

  return (newProps: TransitionProps) => {
    return newProps.element(tState.value)
  }
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
