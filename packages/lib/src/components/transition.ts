import { onMount } from "../hooks/onMount.js"
import { unwrap } from "../signals/utils.js"
import { setup } from "../hooks/setup.js"
import type { Signalable } from "../types.js"

export type TransitionState = "entering" | "entered" | "exiting" | "exited"
interface TransitionProps {
  in: Signalable<boolean>
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

/**
 * Enables control of the DOM in a procedural/coroutine-like fashion. Useful for modals, drawers, dialogs and more.
 * @see https://kirujs.dev/docs/components/transition
 */
export const Transition: Kiru.FC<TransitionProps> = () => {
  const $ = setup<typeof Transition>()
  const tState = $.derive<TransitionState>((p) => p.initialState || "exited")
  const inState = $.derive((p) => unwrap(p.in, true))
  let timeoutRef: number | undefined

  const setTransitionState = (transitionState: TransitionState) => {
    clearTimeout(timeoutRef)
    tState.value = transitionState
    if (transitionState === "entered" || transitionState === "exited") {
      $.props.onTransitionEnd?.(transitionState)
    }
  }

  const queueStateChange = (transitionState: "entered" | "exited") => {
    timeoutRef = window.setTimeout(
      () => setTransitionState(transitionState),
      getTiming(transitionState, $.props.duration)
    )
  }

  const onInChange = (currentIn: boolean) => {
    const t = tState.peek()
    if (currentIn && t !== "entered" && t !== "entering") {
      setTransitionState("entering")
      queueStateChange("entered")
    } else if (!currentIn && t !== "exited" && t !== "exiting") {
      setTransitionState("exiting")
      queueStateChange("exited")
    }
  }

  const unsub = inState.subscribe(onInChange)

  onMount(() => {
    onInChange(inState.peek())
    return () => {
      unsub()
      clearTimeout(timeoutRef)
    }
  })

  return (props) => props.element(tState.value)
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
