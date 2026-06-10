import type { Router } from "kiru/router"

export type OutletDebugEntry = {
  ts: number
  event: string
  data?: Record<string, unknown>
}

export type RouterDiagnosticsDomSnapshot = {
  postPage: boolean
  home: boolean
  feedPost: boolean
  postModal: boolean
  feedFallback: boolean
  loginModal: boolean
  layout: boolean
  communityKiru: boolean
  communityWebdev: boolean
  about: boolean
  settings: boolean
  userPage: boolean
  loginPage: boolean
  submit: boolean
}

export type RouterDiagnosticsSnapshot = {
  ts: number
  label?: string
  location: { pathname: string; href: string }
  dom: RouterDiagnosticsDomSnapshot
  router: {
    pathname: string
    matchRouteId: string | null
    matchRoutePath: string | null
    matchPathname: string | null
    isNavigating: boolean
    isLoaderPending: boolean
    loaderEpoch: number
    navGeneration: number | null
    interceptActive: boolean
    interceptTargetPathname: string | null
    interceptBackgroundPathname: string | null
    outletRenderError: string | null
  } | null
  interceptors: Array<{
    id: string
    targetPath: string
    ownerKind: string
    action: "register" | "unregister"
    ts: number
  }>
  outletDebugLog: OutletDebugEntry[]
  network?: {
    loaderRequests: Array<{ url: string; status: number; at: number }>
  }
  blankFrames?: number
}

export type NavDiagnosticsExpect = {
  label: string
  pathname: string
  matchRoutePath: string | RegExp
  interceptActive?: boolean
  interceptTargetPathname?: string | null
  interceptBackgroundPathname?: string | null
  dom: Partial<RouterDiagnosticsDomSnapshot> & { appNotEmpty?: true }
  settled?: boolean
  forbidOutletEvents?: string[]
  minInterceptorRegisters?: number
  maxBlankFrames?: number
}

function readActiveRouter(): Router | undefined {
  return (globalThis as { __kiru_router?: Router }).__kiru_router
}

function readDomFlags(): RouterDiagnosticsDomSnapshot {
  return {
    postPage: !!document.querySelector('[data-testid="threadboard-post-page"]'),
    home: !!document.querySelector('[data-testid="threadboard-home"]'),
    feedPost: !!document.querySelector('[data-testid="feed-post-p-1"]'),
    postModal: !!document.querySelector('[data-testid="post-modal"]'),
    feedFallback: !!document.querySelector('[data-testid="feed-fallback"]'),
    loginModal: !!document.querySelector('[data-testid="login-modal"]'),
    layout: !!document.querySelector(
      '[data-testid="threadboard-layout"], [data-testid="app-layout"]'
    ),
    communityKiru: !!document.querySelector(
      '[data-testid="threadboard-community-kiru"]'
    ),
    communityWebdev: !!document.querySelector(
      '[data-testid="threadboard-community-webdev"]'
    ),
    about: !!document.querySelector('[data-testid="threadboard-about"]'),
    settings: !!document.querySelector('[data-testid="threadboard-settings"]'),
    userPage: !!document.querySelector('[data-testid="threadboard-user-page"]'),
    loginPage: !!document.querySelector('[data-testid="threadboard-login-page"]'),
    submit: !!document.querySelector('[data-testid="threadboard-submit"]'),
  }
}

export function snapshotRouterDiagnostics(
  label?: string
): RouterDiagnosticsSnapshot {
  const router = readActiveRouter()
  const match = router?.match.peek() ?? null
  const intercept = router?.interceptState.peek() ?? null

  return {
    ts: performance.now(),
    label,
    location: {
      pathname: window.location.pathname,
      href: window.location.href,
    },
    dom: readDomFlags(),
    router: router
      ? {
          pathname: router.pathname.peek(),
          matchRouteId: match?.route.id ?? null,
          matchRoutePath: match?.route.path ?? null,
          matchPathname: match?.pathname ?? null,
          isNavigating: router.isNavigating.peek(),
          isLoaderPending: router.isLoaderPending.peek(),
          loaderEpoch: router.loaderEpoch.peek(),
          navGeneration: null,
          interceptActive: intercept != null,
          interceptTargetPathname: intercept?.targetMatch.pathname ?? null,
          interceptBackgroundPathname:
            intercept?.backgroundMatch.pathname ?? null,
          outletRenderError: router.outletRenderError.peek()?.message ?? null,
        }
      : null,
    interceptors: (window.__kiruOutletDebugLog ?? [])
      .filter((entry) => entry.event.startsWith("interceptor:"))
      .map((entry) => ({
        id: String(entry.data?.slot ?? entry.data?.target ?? ""),
        targetPath: String(entry.data?.target ?? ""),
        ownerKind: String(entry.data?.ownerKind ?? ""),
        action: entry.event.replace("interceptor:", "") as "register" | "unregister",
        ts: entry.ts,
      })),
    outletDebugLog: [...(window.__kiruOutletDebugLog ?? [])],
    network: window.__kiruE2eNetworkLog
      ? { loaderRequests: window.__kiruE2eNetworkLog }
      : undefined,
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

export function assertRouterDiagnosticsSnapshot(
  snapshot: RouterDiagnosticsSnapshot,
  expected: NavDiagnosticsExpect
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

  if (!matchRoutePath(router.matchRoutePath, expected.matchRoutePath)) {
    errors.push(
      `matchRoutePath: expected ${String(expected.matchRoutePath)}, got ${router.matchRoutePath}`
    )
  }

  if (
    expected.interceptActive !== undefined &&
    router.interceptActive !== expected.interceptActive
  ) {
    errors.push(
      `interceptActive: expected ${expected.interceptActive}, got ${router.interceptActive}`
    )
  }

  if (expected.interceptTargetPathname !== undefined) {
    if (router.interceptTargetPathname !== expected.interceptTargetPathname) {
      errors.push(
        `interceptTargetPathname: expected ${expected.interceptTargetPathname}, got ${router.interceptTargetPathname}`
      )
    }
  }

  if (expected.interceptBackgroundPathname !== undefined) {
    if (
      router.interceptBackgroundPathname !== expected.interceptBackgroundPathname
    ) {
      errors.push(
        `interceptBackgroundPathname: expected ${expected.interceptBackgroundPathname}, got ${router.interceptBackgroundPathname}`
      )
    }
  }

  const settled = expected.settled !== false
  if (settled) {
    if (router.isLoaderPending) errors.push("loader still pending")
  }
  if (expected.settled === true) {
    if (router.isNavigating) errors.push("router still navigating")
  }

  for (const [key, value] of Object.entries(expected.dom)) {
    if (key === "appNotEmpty") {
      if (value && document.getElementById("app")?.children.length === 0) {
        errors.push("#app is empty")
      }
      continue
    }
    const domKey = key as keyof RouterDiagnosticsDomSnapshot
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

  if (expected.minInterceptorRegisters != null) {
    const registers = snapshot.interceptors.filter(
      (i) => i.action === "register"
    ).length
    if (registers < expected.minInterceptorRegisters) {
      errors.push(
        `interceptor registers: expected >= ${expected.minInterceptorRegisters}, got ${registers}`
      )
    }
  }

  if (expected.maxBlankFrames != null) {
    const count = snapshot.blankFrames ?? 0
    if (count > expected.maxBlankFrames) {
      errors.push(
        `blank frames: expected <= ${expected.maxBlankFrames}, got ${count}`
      )
    }
  }

  if (
    expected.interceptActive === true &&
    expected.dom.postModal === true &&
    !snapshot.dom.postModal
  ) {
    errors.push("intercept active but post modal DOM not visible")
  }

  if (
    expected.interceptActive === true &&
    expected.dom.loginModal === true &&
    !snapshot.dom.loginModal
  ) {
    errors.push("intercept active but login modal DOM not visible")
  }

  if (
    !router.interceptActive &&
    expected.dom.postModal === false &&
    snapshot.dom.postModal
  ) {
    errors.push("post modal visible but intercept inactive")
  }

  return errors
}

type KiruE2eNetworkEntry = { url: string; status: number; at: number }

declare global {
  interface Window {
    __kiruE2eDiagnostics?: {
      snapshot: (label?: string) => RouterDiagnosticsSnapshot
      clearNetworkLog: () => void
      resetBlankFrameCount: () => void
      assert: (expected: NavDiagnosticsExpect) => string[]
    }
    __kiruE2eNetworkLog?: KiruE2eNetworkEntry[]
    __kiruBlankFrameCount?: number
    __kiruBlankFrameWatcherInstalled?: boolean
  }
}

export function installBlankFrameWatcher(
  appSelector = "#app",
  intervalMs = 16
): () => void {
  if (typeof window === "undefined") return () => {}
  if (window.__kiruBlankFrameWatcherInstalled) return () => {}
  window.__kiruBlankFrameWatcherInstalled = true
  window.__kiruBlankFrameCount = 0

  const id = window.setInterval(() => {
    const app = document.querySelector(appSelector)
    if (app && app.children.length === 0) {
      window.__kiruBlankFrameCount = (window.__kiruBlankFrameCount ?? 0) + 1
    }
  }, intervalMs)

  return () => {
    window.clearInterval(id)
    window.__kiruBlankFrameWatcherInstalled = false
  }
}

export function installE2eRouterDiagnostics(): void {
  if (typeof window === "undefined") return
  window.__kiruE2eNetworkLog ??= []
  window.__kiruBlankFrameCount ??= 0
  installBlankFrameWatcher()
  window.__kiruE2eDiagnostics = {
    snapshot: snapshotRouterDiagnostics,
    clearNetworkLog: () => {
      window.__kiruE2eNetworkLog = []
    },
    resetBlankFrameCount: () => {
      window.__kiruBlankFrameCount = 0
    },
    assert: (expected) => {
      const snapshot = snapshotRouterDiagnostics(expected.label)
      return assertRouterDiagnosticsSnapshot(snapshot, expected)
    },
  }
}
