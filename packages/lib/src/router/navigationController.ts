import type { Signal } from "../signals/base.js"
import {
  formatRouterSearch,
  parseResolvedLocation,
  type NavigationPipelineDeps,
  type RouteLocationParts,
} from "./navigation.js"
import {
  canAcceptOutletSettled,
  createInitialMachineState,
  currentNavigationFromPhase,
  interceptStateFromPhase,
  transition,
  type InterceptPayload,
  type MachineEvent,
  type RouterMachineState,
  type RouterPhase,
} from "./navigationMachine.js"
import { createNavigationRunner } from "./navigationRunner.js"
import { logOutletDebug } from "./outletDebug.js"
import { matchRoute } from "./manifest.js"
import type {
  CurrentNavigation,
  RouteInterceptState,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import type { RouterPathPolicy } from "./pathPolicy.js"
import { staticLoaderSignal } from "./navigationScope.js"
import type {
  InterceptorRegistration,
  KiruHistoryInterceptState,
} from "./routeInterceptors.js"
import {
  backgroundMatchFromHistoryIntercept,
  findRegistrationForHistoryIntercept,
} from "./routeInterceptors.js"
import { parseAppLocation } from "./i18n/routing.js"
import type { I18nLocaleRouting } from "./i18n/localeRouting.js"
import type { ResolvedRequestLimits } from "./requestLimits.js"

export type NavigationControllerDeps = Omit<
  NavigationPipelineDeps,
  "navToken" | "navAbortController"
> & {
  isNavigating: Signal<boolean>
  currentNavigation: Signal<CurrentNavigation | null>
  interceptState: Signal<RouteInterceptState | null>
  manifest: RouteManifest
  resolvedPathPolicy: Required<RouterPathPolicy>
  normalizedBaseUrl: string
  localeRouting?: I18nLocaleRouting
  requestLimits: ResolvedRequestLimits
  transitionsEnabled: boolean
}

export type PopstateClassification =
  | { kind: "dismiss_intercept"; resolved: RouteLocationParts }
  | {
      kind: "restore_intercept"
      resolved: RouteLocationParts & { href: string }
      historyIntercept: KiruHistoryInterceptState
    }
  | { kind: "noop" }
  | { kind: "navigate"; href: string }

export function createNavigationController(deps: NavigationControllerDeps) {
  let machine = createInitialMachineState()
  let navIdSeq = 0
  let outletLoaded = false

  function syncPublicSignals() {
    deps.isNavigating.value = machine.phase.kind === "navigating"
    deps.currentNavigation.value = currentNavigationFromPhase(machine.phase)
    const fromPhase = interceptStateFromPhase(machine.phase)
    if (machine.phase.kind === "intercepted") {
      deps.interceptState.value = fromPhase
    } else if (machine.phase.kind === "idle") {
      deps.interceptState.value = null
    }
  }

  function apply(event: MachineEvent): RouterMachineState {
    if (event.type === "NAV_REQUEST") outletLoaded = false
    const { state, effects } = transition(machine, event)
    machine = state
    void effects
    syncPublicSignals()
    const phase = machine.phase
    logOutletDebug("machine:transition", {
      event: event.type,
      kind: phase.kind,
      sub: phase.kind !== "idle" ? phase.sub : null,
      generation: machine.generation,
    })
    return machine
  }

  function tryCompleteAwaitingOutlet(): boolean {
    if (!outletLoaded) return false
    const phase = machine.phase
    if (phase.kind !== "navigating" || phase.sub !== "awaitingOutlet") {
      return false
    }
    outletLoaded = false
    return runner.notifyOutletSettled()
  }

  const runner = createNavigationRunner({
    apply,
    transitionsEnabled: deps.transitionsEnabled,
    onAwaitOutlet: () => {
      tryCompleteAwaitingOutlet()
    },
    buildWorkflowDeps: ({ token, signal, isStale }) => ({
      ...deps,
      navToken: runner.getNavToken(),
      navAbortController: runner.getNavAbortController(),
      token,
      signal,
      isStale,
    }),
  })

  const navigateInternal = runner.start

  function getGeneration() {
    return machine.generation
  }

  function getPhase(): RouterPhase {
    return machine.phase
  }

  function snapshot() {
    return { phase: machine.phase, generation: machine.generation }
  }

  function markOutletLoaded() {
    outletLoaded = true
  }

  function notifyOutletSettled(input: {
    pathname: string
    matchParams: Record<string, string>
  }) {
    if (!canAcceptOutletSettled(machine.phase, input)) return false
    outletLoaded = false
    return runner.notifyOutletSettled()
  }

  function notifyInterceptLoadDone(data: unknown) {
    apply({ type: "INTERCEPT_LOAD_DONE", data })
    syncPublicSignals()
  }

  function notifyInterceptLoadError(error: Error) {
    apply({ type: "INTERCEPT_LOAD_ERROR", error })
    syncPublicSignals()
  }

  function dismissInterceptPhase() {
    apply({ type: "DISMISS_INTERCEPT" })
  }

  function classifyPopstate(input: {
    resolved: RouteLocationParts & { href: string }
    historyState: {
      index?: number
      kiruIntercept?: KiruHistoryInterceptState
    } | null
    activeIntercept: RouteInterceptState | null
    pathname: string
    hash: string
    query: Record<string, string[]>
    match: RouteMatch | null
  }): PopstateClassification {
    const { resolved, historyState, activeIntercept, pathname, hash, query, match } =
      input

    if (activeIntercept) {
      const bgPath = activeIntercept.backgroundMatch.pathname
      if (resolved.pathname === bgPath) {
        return { kind: "dismiss_intercept", resolved }
      }
    }

    if (
      !activeIntercept &&
      !historyState?.kiruIntercept &&
      resolved.pathname === pathname &&
      resolved.hash === hash &&
      formatRouterSearch(resolved.query) === formatRouterSearch(query)
    ) {
      const toMatch = matchRoute(
        deps.manifest,
        resolved.pathname,
        deps.resolvedPathPolicy
      )
      if (
        toMatch &&
        match &&
        toMatch.route.id === match.route.id &&
        JSON.stringify(toMatch.params) === JSON.stringify(match.params)
      ) {
        return { kind: "noop" }
      }
    }

    if (historyState?.kiruIntercept) {
      const toMatch = matchRoute(
        deps.manifest,
        resolved.pathname,
        deps.resolvedPathPolicy
      )
      if (toMatch) {
        return {
          kind: "restore_intercept",
          resolved,
          historyIntercept: historyState.kiruIntercept,
        }
      }
    }

    return { kind: "navigate", href: resolved.href }
  }

  function dispatchPopstate(classification: PopstateClassification) {
    switch (classification.kind) {
      case "dismiss_intercept":
        apply({ type: "POPSTATE_DISMISS_INTERCEPT" })
        return
      case "noop":
        apply({ type: "POPSTATE_NOOP" })
        return
      case "restore_intercept":
        return classification
      case "navigate":
        return classification
    }
  }

  function restoreInterceptFromPopstate(input: {
    resolved: RouteLocationParts & { href: string }
    historyIntercept: KiruHistoryInterceptState
    interceptorRegistrations: InterceptorRegistration[]
  }): InterceptPayload | null {
    const toMatch = matchRoute(
      deps.manifest,
      input.resolved.pathname,
      deps.resolvedPathPolicy
    )
    if (!toMatch) return null
    const reg = findRegistrationForHistoryIntercept(
      input.historyIntercept,
      input.interceptorRegistrations,
      deps.manifest,
      toMatch,
      deps.resolvedPathPolicy
    )
    const bgMatch = backgroundMatchFromHistoryIntercept(
      deps.manifest,
      input.historyIntercept,
      deps.resolvedPathPolicy
    )
    if (!reg || !bgMatch) return null
    navIdSeq += 1
    const payload: InterceptPayload = {
      id: navIdSeq,
      registrationId: reg.id,
      background: bgMatch,
      target: toMatch,
    }
    apply({ type: "POPSTATE_RESTORE_INTERCEPT", payload })
    return payload
  }

  function parsePopstateUrl(href: string) {
    const url = new URL(href)
    return deps.localeRouting
      ? parseAppLocation(
          url,
          deps.normalizedBaseUrl,
          deps.localeRouting,
          deps.resolvedPathPolicy,
          deps.requestLimits
        )
      : parseResolvedLocation(url, deps.normalizedBaseUrl, deps.requestLimits)
  }

  return {
    navigateInternal,
    getNavSignal: () =>
      runner.getNavAbortController().current?.signal ?? staticLoaderSignal(),
    getNavAbortController: () => runner.getNavAbortController(),
    getGeneration,
    getPhase,
    snapshot,
    notifyOutletSettled,
    markOutletLoaded,
    notifyInterceptLoadDone,
    notifyInterceptLoadError,
    dismissInterceptPhase,
    classifyPopstate,
    dispatchPopstate,
    restoreInterceptFromPopstate,
    parsePopstateUrl,
    apply,
    syncPublicSignals,
  }
}

export type NavigationController = ReturnType<typeof createNavigationController>
