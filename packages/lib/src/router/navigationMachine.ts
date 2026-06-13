import type { RouteLocationSnapshot, RouteMatch } from "./types.js"

export type NavIntent = "push" | "replace" | "popstate"

export type NavigatingSub = "validating" | "committing" | "awaitingOutlet"

export type InterceptedSub = "loading" | "ready" | "error"

export type CommitKind = "hard" | "intercept" | "error"

export type RouterPhase =
  | { kind: "idle" }
  | {
      kind: "navigating"
      sub: NavigatingSub
      id: number
      intent: NavIntent
      to: RouteLocationSnapshot
      from: RouteLocationSnapshot | null
      commitKind?: CommitKind
    }
  | {
      kind: "intercepted"
      sub: InterceptedSub
      id: number
      registrationId: number
      background: RouteMatch
      target: RouteMatch
      data: unknown | null
      error: Error | null
    }

export type RouterMachineState = {
  phase: RouterPhase
  generation: number
}

export type InterceptPayload = {
  id: number
  registrationId: number
  background: RouteMatch
  target: RouteMatch
}

export type MachineEvent =
  | {
      type: "NAV_REQUEST"
      id: number
      intent: NavIntent
      to: RouteLocationSnapshot
      from: RouteLocationSnapshot | null
    }
  | { type: "VALIDATION_OK"; commitKind: CommitKind }
  | { type: "VALIDATION_CANCEL" }
  | {
      type: "VALIDATION_REDIRECT"
      id: number
      to: RouteLocationSnapshot
      from: RouteLocationSnapshot | null
      intent: NavIntent
    }
  | { type: "COMMIT_HARD" }
  | { type: "COMMIT_ERROR" }
  | { type: "COMMIT_INTERCEPT"; payload: InterceptPayload }
  | { type: "OUTLET_SETTLED" }
  | { type: "INTERCEPT_LOAD_DONE"; data: unknown }
  | { type: "INTERCEPT_LOAD_ERROR"; error: Error }
  | { type: "DISMISS_INTERCEPT" }
  | { type: "POPSTATE_DISMISS_INTERCEPT" }
  | { type: "POPSTATE_RESTORE_INTERCEPT"; payload: InterceptPayload }
  | { type: "POPSTATE_NOOP" }
  | { type: "VALIDATION_ERROR_BEFORE_COMMIT" }

export type MachineEffect =
  | { type: "RUN_AFTER_EACH"; outcome: "settled" | "cancelled" | "intercept" }

export type TransitionResult = {
  state: RouterMachineState
  effects: MachineEffect[]
}

export function createInitialMachineState(): RouterMachineState {
  return { phase: { kind: "idle" }, generation: 0 }
}

export function isNavigatingPhase(phase: RouterPhase): boolean {
  return phase.kind === "navigating"
}

export function isInterceptedPhase(phase: RouterPhase): boolean {
  return phase.kind === "intercepted"
}

export function navigatingId(phase: RouterPhase): number | null {
  return phase.kind === "navigating" ? phase.id : null
}

export function transition(
  state: RouterMachineState,
  event: MachineEvent
): TransitionResult {
  const effects: MachineEffect[] = []
  const { phase } = state

  switch (event.type) {
    case "NAV_REQUEST": {
      const generation = state.generation + 1
      return {
        state: {
          generation,
          phase: {
            kind: "navigating",
            sub: "validating",
            id: event.id,
            intent: event.intent,
            to: event.to,
            from: event.from,
          },
        },
        effects,
      }
    }

    case "VALIDATION_REDIRECT": {
      if (phase.kind !== "navigating" || phase.sub !== "validating") {
        return { state, effects }
      }
      return {
        state: {
          generation: state.generation + 1,
          phase: {
            kind: "navigating",
            sub: "validating",
            id: event.id,
            intent: event.intent,
            to: event.to,
            from: event.from,
          },
        },
        effects,
      }
    }

    case "VALIDATION_CANCEL": {
      if (phase.kind !== "navigating") return { state, effects }
      effects.push({ type: "RUN_AFTER_EACH", outcome: "cancelled" })
      return {
        state: { ...state, phase: { kind: "idle" } },
        effects,
      }
    }

    case "VALIDATION_ERROR_BEFORE_COMMIT": {
      if (phase.kind !== "navigating") return { state, effects }
      effects.push({ type: "RUN_AFTER_EACH", outcome: "cancelled" })
      return {
        state: { ...state, phase: { kind: "idle" } },
        effects,
      }
    }

    case "VALIDATION_OK": {
      if (phase.kind !== "navigating" || phase.sub !== "validating") {
        return { state, effects }
      }
      return {
        state: {
          ...state,
          phase: {
            ...phase,
            sub: "committing",
            commitKind: event.commitKind,
          },
        },
        effects,
      }
    }

    case "COMMIT_HARD":
    case "COMMIT_ERROR": {
      if (phase.kind !== "navigating" || phase.sub !== "committing") {
        return { state, effects }
      }
      return {
        state: {
          ...state,
          phase: {
            ...phase,
            sub: "awaitingOutlet",
            commitKind: event.type === "COMMIT_ERROR" ? "error" : "hard",
          },
        },
        effects,
      }
    }

    case "COMMIT_INTERCEPT": {
      if (phase.kind !== "navigating" || phase.sub !== "committing") {
        return { state, effects }
      }
      const p = event.payload
      effects.push({ type: "RUN_AFTER_EACH", outcome: "intercept" })
      return {
        state: {
          ...state,
          phase: {
            kind: "intercepted",
            sub: "loading",
            id: p.id,
            registrationId: p.registrationId,
            background: p.background,
            target: p.target,
            data: null,
            error: null,
          },
        },
        effects,
      }
    }

    case "OUTLET_SETTLED": {
      if (phase.kind !== "navigating" || phase.sub !== "awaitingOutlet") {
        return { state, effects }
      }
      effects.push({ type: "RUN_AFTER_EACH", outcome: "settled" })
      return {
        state: { ...state, phase: { kind: "idle" } },
        effects,
      }
    }

    case "INTERCEPT_LOAD_DONE": {
      if (phase.kind !== "intercepted" || phase.sub !== "loading") {
        return { state, effects }
      }
      return {
        state: {
          ...state,
          phase: {
            ...phase,
            sub: "ready",
            data: event.data,
            error: null,
          },
        },
        effects,
      }
    }

    case "INTERCEPT_LOAD_ERROR": {
      if (phase.kind !== "intercepted" || phase.sub !== "loading") {
        return { state, effects }
      }
      return {
        state: {
          ...state,
          phase: {
            ...phase,
            sub: "error",
            data: null,
            error: event.error,
          },
        },
        effects,
      }
    }

    case "DISMISS_INTERCEPT":
    case "POPSTATE_DISMISS_INTERCEPT": {
      if (phase.kind !== "intercepted") return { state, effects }
      return {
        state: { ...state, phase: { kind: "idle" } },
        effects,
      }
    }

    case "POPSTATE_RESTORE_INTERCEPT": {
      const p = event.payload
      return {
        state: {
          ...state,
          phase: {
            kind: "intercepted",
            sub: "loading",
            id: p.id,
            registrationId: p.registrationId,
            background: p.background,
            target: p.target,
            data: null,
            error: null,
          },
        },
        effects,
      }
    }

    case "POPSTATE_NOOP": {
      if (phase.kind !== "navigating") return { state, effects }
      return {
        state: { ...state, phase: { kind: "idle" } },
        effects,
      }
    }

    default:
      return { state, effects }
  }
}

/** Whether outlet settle should end the active navigation. */
export function canAcceptOutletSettled(
  phase: RouterPhase,
  input: {
    pathname: string
    matchParams: Record<string, string>
  }
): boolean {
  if (phase.kind !== "navigating" || phase.sub !== "awaitingOutlet") {
    return false
  }
  if (phase.to.pathname !== input.pathname) return false
  return (
    JSON.stringify(phase.to.params) === JSON.stringify(input.matchParams)
  )
}

export function interceptStateFromPhase(
  phase: RouterPhase
): {
  registrationId: number
  backgroundMatch: RouteMatch
  targetMatch: RouteMatch
  data: unknown | null
  error: Error | null
} | null {
  if (phase.kind !== "intercepted") return null
  return {
    registrationId: phase.registrationId,
    backgroundMatch: phase.background,
    targetMatch: phase.target,
    data: phase.data,
    error: phase.error,
  }
}

export function currentNavigationFromPhase(
  phase: RouterPhase
): { from: RouteLocationSnapshot | null; to: RouteLocationSnapshot } | null {
  if (phase.kind !== "navigating") return null
  return { from: phase.from, to: phase.to }
}
