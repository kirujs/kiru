import { createContext } from "../context.js"
import { $HYDRATION_BOUNDARY } from "../constants.js"
import { createElement, Fragment } from "../element.js"
import { renderMode } from "../globals.js"

type EventsArray = (keyof GlobalEventHandlersEventMap)[]

export const HYDRATION_BOUNDARY_MARKER = "kiru:h-boundary"
export const DEFAULT_INTERACTION_EVENTS = [
  "pointerdown",
  "keydown",
  "focus",
  "input",
] as const satisfies EventsArray

export type HydrationBoundaryMode = "eager" | "interaction"
export type HydrationBoundaryProps<T extends HydrationBoundaryMode> = {
  /**
   * Determines the strategy to use when hydrating the boundary.
   * - `eager`: hydrate immediately.
   * - `interaction`: hydrate upon the first user interaction.
   * @default "eager"
   */
  mode?: T
  children: JSX.Children
} & (T extends "interaction"
  ? {
      /**
       * List of events that will trigger the hydration.
       * @default ["pointerdown", "keydown", "focus", "input"]
       */
      events?: EventsArray
    }
  : {})

export const HydrationBoundaryContext = createContext<{
  mode: HydrationBoundaryMode
  events: string[]
}>(null!)

export function Experimental_HydrationBoundary<T extends HydrationBoundaryMode>(
  props: HydrationBoundaryProps<T>
) {
  const provider = createElement(
    HydrationBoundaryContext.Provider,
    {
      value: {
        mode: props.mode || "eager",
        // @ts-expect-error this is fine
        events: props.events ?? DEFAULT_INTERACTION_EVENTS,
      },
    },
    createElement($HYDRATION_BOUNDARY, props)
  )
  if (renderMode.current === "string" || renderMode.current === "stream") {
    /**
     * in order to ensure consistent tree structure, we're simulating
     * the generated loader + wrapper components here.
     */
    return Fragment({ children: Fragment({ children: provider }) })
  }
  return provider
}
