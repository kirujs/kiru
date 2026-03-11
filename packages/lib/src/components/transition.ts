import { onCleanup } from "../hooks/onCleanup.js"
import { Signal } from "../signals/base.js"
import { unwrap } from "../signals/utils.js"
import { setup } from "../hooks/setup.js"

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

/**
 * Animates the DOM in a procedural/coroutine-like fashion. Useful for modals, drawers, dialogs and more.
 * @see https://kirujs.dev/docs/components/transition
 */
export const Transition: Kiru.FC<TransitionProps> = (props) => {
  const $ = setup<typeof Transition>()
  const tState = $.derive<TransitionState>((p) => p.initialState || "exited")
  const inState = $.derive((p) => unwrap(p.in, true))
  let timeoutRef: number | undefined
  let onTransitionEnd = props.onTransitionEnd
  let duration = props.duration

  const setTransitionState = (transitionState: TransitionState) => {
    clearTimeout(timeoutRef)
    tState.value = transitionState
    if (transitionState === "entered" || transitionState === "exited") {
      onTransitionEnd?.(transitionState)
    }
  }

  const queueStateChange = (transitionState: "entered" | "exited") => {
    timeoutRef = window.setTimeout(
      () => setTransitionState(transitionState),
      getTiming(transitionState, duration)
    )
  }

  const unsub = inState.subscribe((newIn) => {
    const current = tState.peek()
    if (newIn && current !== "entered" && current !== "entering") {
      setTransitionState("entering")
      queueStateChange("entered")
    } else if (!newIn && current !== "exited" && current !== "exiting") {
      setTransitionState("exiting")
      queueStateChange("exited")
    }
  })

  onCleanup(() => (unsub(), clearTimeout(timeoutRef)))

  return (props) => {
    duration = props.duration
    onTransitionEnd = props.onTransitionEnd
    return props.element(tState.value)
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
