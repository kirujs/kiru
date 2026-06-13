import type { Router } from "kiru/router"
import {
  installBlankFrameWatcher,
  type OutletDebugEntry,
} from "../../../shared/routerDiagnostics.js"

const ROUTER_RUNTIME = Symbol.for("kiru.router.runtime")

export type CsrRouterDiagnosticsDomSnapshot = {
  home: boolean
  about: boolean
  user: boolean
  loaderData: boolean
  slowTarget: boolean
  errorPage: boolean
  loaderError: boolean
  navInProgress: boolean
  forbiddenPage: boolean
  outletChildCount: number
  outletContentNull: boolean
}

export type CsrRouterDiagnosticsSnapshot = {
  ts: number
  label?: string
  location: { pathname: string; href: string }
  dom: CsrRouterDiagnosticsDomSnapshot
  router: {
    pathname: string
    matchRouteId: string | null
    matchRoutePath: string | null
    matchPathname: string | null
    isNavigating: boolean
    isLoaderPending: boolean
    loaderEpoch: number
    navGeneration: number | null
    fsmPhase: string | null
    fsmSub: string | null
    interceptActive: boolean
    outletRenderError: string | null
    resourcePending: boolean | null
    resourceHasValue: boolean | null
    outletRouteId: string | null
  } | null
  outletDebugLog: OutletDebugEntry[]
  blankFrames?: number
}

export type CsrNavDiagnosticsExpect = {
  label: string
  pathname: string
  matchRoutePath?: string | RegExp
  dom: Partial<CsrRouterDiagnosticsDomSnapshot>
  settled?: boolean
  forbidOutletEvents?: string[]
}

type RouterRuntimePeek = {
  getNavigationController?: () => {
    getGeneration: () => number
    getPhase: () => { kind: string; sub?: string }
  }
}

function readActiveRouter(): Router | undefined {
  return (globalThis as { __kiru_router?: Router }).__kiru_router
}

function readNavController(router: Router) {
  const runtime = (router as Record<symbol, RouterRuntimePeek | undefined>)[
    ROUTER_RUNTIME
  ]
  return runtime?.getNavigationController?.()
}

function readCsrDomFlags(): CsrRouterDiagnosticsDomSnapshot {
  const outlet = document.querySelector("#router-outlet")
  const outletChildCount = outlet?.children.length ?? 0
  const hasAbout = !!document.querySelector('[data-testid="csr-about"]')
  const hasLoaderData = !!document.querySelector('[data-testid="loader-data"]')
  const hasSlowTarget = !!document.querySelector('[data-testid="slow-target"]')
  const hasErrorPage = !!document.querySelector('[data-testid="csr-error-page"]')
  const hasLoaderError = !!document.querySelector(
    '[data-testid="csr-loader-error"]'
  )
  const hasHome = !!document.querySelector('[data-testid="home-page"]')
  const hasUser = !!document.querySelector('[data-testid="csr-user"]')
  const hasForbidden = !!document.querySelector('[data-testid="forbidden-page"]')
  const navInProgressEl = document.querySelector('[data-testid="nav-in-progress"]')
  const navInProgress =
    navInProgressEl?.textContent?.trim().toLowerCase() === "yes"

  return {
    home: hasHome,
    about: hasAbout,
    user: hasUser,
    loaderData: hasLoaderData,
    slowTarget: hasSlowTarget,
    errorPage: hasErrorPage,
    loaderError: hasLoaderError,
    navInProgress,
    forbiddenPage: hasForbidden,
    outletChildCount,
    outletContentNull:
      outletChildCount === 0 &&
      !hasAbout &&
      !hasLoaderData &&
      !hasSlowTarget &&
      !hasErrorPage &&
      !hasLoaderError &&
      !hasHome &&
      !hasUser &&
      !hasForbidden,
  }
}

export function snapshotCsrRouterDiagnostics(
  label?: string
): CsrRouterDiagnosticsSnapshot {
  const router = readActiveRouter()
  const match = router?.match.peek() ?? null
  const intercept = router?.interceptState.peek() ?? null
  const ctrl = router ? readNavController(router) : undefined
  const phase = ctrl?.getPhase()
  const outletState = window.__kiruOutletState

  return {
    ts: performance.now(),
    label,
    location: {
      pathname: window.location.pathname,
      href: window.location.href,
    },
    dom: readCsrDomFlags(),
    router: router
      ? {
          pathname: router.pathname.peek(),
          matchRouteId: match?.route.id ?? null,
          matchRoutePath: match?.route.path ?? null,
          matchPathname: match?.pathname ?? null,
          isNavigating: router.isNavigating.peek(),
          isLoaderPending: router.isLoaderPending.peek(),
          loaderEpoch: router.loaderEpoch.peek(),
          navGeneration: ctrl?.getGeneration() ?? null,
          fsmPhase: phase?.kind ?? null,
          fsmSub:
            phase && phase.kind === "navigating" && "sub" in phase
              ? String(phase.sub)
              : null,
          interceptActive: intercept != null,
          outletRenderError: router.outletRenderError.peek()?.message ?? null,
          resourcePending: outletState?.resourcePending ?? null,
          resourceHasValue: outletState?.resourceHasValue ?? null,
          outletRouteId: outletState?.routeId ?? null,
        }
      : null,
    outletDebugLog: [...(window.__kiruOutletDebugLog ?? [])],
    blankFrames: window.__kiruBlankFrameCount ?? 0,
  }
}

function matchRoutePath(
  actual: string | null,
  expected: string | RegExp
): boolean {
  if (actual == null) return false
  if (typeof expected === "string") return actual === expected
  return expected.test(actual)
}

export function assertCsrRouterDiagnosticsSnapshot(
  snapshot: CsrRouterDiagnosticsSnapshot,
  expected: CsrNavDiagnosticsExpect
): string[] {
  const errors: string[] = []
  const router = snapshot.router

  if (snapshot.location.pathname !== expected.pathname) {
    errors.push(
      `location.pathname: expected ${expected.pathname}, got ${snapshot.location.pathname}`
    )
  }

  if (!router) {
    errors.push("router snapshot missing")
    return errors
  }

  if (router.pathname !== snapshot.location.pathname) {
    errors.push(
      `router/location desync: router=${router.pathname} location=${snapshot.location.pathname}`
    )
  }

  if (expected.matchRoutePath != null) {
    if (!matchRoutePath(router.matchRoutePath, expected.matchRoutePath)) {
      errors.push(
        `matchRoutePath: expected ${String(expected.matchRoutePath)}, got ${router.matchRoutePath}`
      )
    }
  }

  const settled = expected.settled !== false
  if (settled && router.isLoaderPending) {
    errors.push("loader still pending")
  }
  if (expected.settled === true && router.isNavigating) {
    errors.push("router still navigating")
  }

  for (const [key, value] of Object.entries(expected.dom)) {
    const domKey = key as keyof CsrRouterDiagnosticsDomSnapshot
    if (snapshot.dom[domKey] !== value) {
      errors.push(`dom.${key}: expected ${value}, got ${snapshot.dom[domKey]}`)
    }
  }

  if (expected.forbidOutletEvents?.length) {
    for (const event of expected.forbidOutletEvents) {
      if (snapshot.outletDebugLog.some((e) => e.event === event)) {
        errors.push(`forbidden outlet event: ${event}`)
      }
    }
  }

  return errors
}

declare global {
  interface Window {
    __kiruCsrE2eDiagnostics?: {
      snapshot: (label?: string) => CsrRouterDiagnosticsSnapshot
      assert: (expected: CsrNavDiagnosticsExpect) => string[]
    }
    __kiruOutletState?: {
      resourcePending: boolean
      resourceHasValue: boolean
      routeId: string | null
      mode: string
    }
  }
}

export function installCsrRouterDiagnostics(): void {
  if (typeof window === "undefined") return
  window.__kiruBlankFrameCount ??= 0
  installBlankFrameWatcher()
  window.__kiruCsrE2eDiagnostics = {
    snapshot: snapshotCsrRouterDiagnostics,
    assert: (expected) => {
      const snapshot = snapshotCsrRouterDiagnostics(expected.label)
      return assertCsrRouterDiagnosticsSnapshot(snapshot, expected)
    },
  }
}
