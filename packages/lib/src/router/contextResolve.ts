import {
  shouldAwaitContext,
  shouldResolveContext,
  type ContextGateOptions,
} from "./routeMeta.js"
import type {
  ContextState,
  CustomRequestContext,
  ResolveContextEvent,
  RouteLocationSnapshot,
  RouteMatch,
} from "./types.js"

export async function runContextResolve(input: {
  match: RouteMatch | null
  to: RouteLocationSnapshot
  from: RouteLocationSnapshot | null
  resolveContext: (event: ResolveContextEvent) => Promise<CustomRequestContext>
  gateOptions: ContextGateOptions
  contextState: { value: ContextState }
  requestContext: { value: CustomRequestContext }
  navEpoch: number
  getNavEpoch: () => number
  stickyContext: boolean
  hadReadyContext: boolean
  eventType: "initial" | "navigation" | "refresh"
}): Promise<CustomRequestContext> {
  const { match, gateOptions, resolveContext } = input
  if (!match || !shouldResolveContext(match, gateOptions)) {
    return input.requestContext.value
  }
  if (
    input.stickyContext &&
    input.hadReadyContext &&
    shouldAwaitContext(match, gateOptions) === false &&
    gateOptions.contextGate !== "block"
  ) {
    return input.requestContext.value
  }
  const awaitResolve = shouldAwaitContext(match, gateOptions)
  if (awaitResolve) {
    input.contextState.value = "pending"
  }
  const event: ResolveContextEvent =
    input.eventType === "initial"
      ? { type: "initial" }
      : input.eventType === "refresh"
        ? { type: "refresh" }
        : { type: "navigation", to: input.to, from: input.from }
  try {
    const ctx = await resolveContext(event)
    if (input.getNavEpoch() !== input.navEpoch) {
      return input.requestContext.value
    }
    input.requestContext.value = ctx
    input.contextState.value = "ready"
    return ctx
  } catch {
    if (input.getNavEpoch() !== input.navEpoch) {
      return input.requestContext.value
    }
    input.contextState.value = "ready"
    return input.requestContext.value
  }
}

export function scheduleBackgroundContextResolve(
  input: Omit<Parameters<typeof runContextResolve>[0], "eventType"> & {
    eventType?: "navigation"
  }
): void {
  const { match, gateOptions } = input
  if (!match || !shouldResolveContext(match, gateOptions)) return
  if (shouldAwaitContext(match, gateOptions)) return
  void runContextResolve({ ...input, eventType: "navigation" })
}
