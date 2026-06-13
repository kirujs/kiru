import { __DEV__ } from "../env.js"
import { addBase } from "./pathPolicy.js"
import {
  checkUrlWithinLimits,
  DEFAULT_REQUEST_LIMITS,
} from "./requestLimits.js"
import { warnOnce } from "./devWarnings.dev.js"
import type {
  NavigationFailure,
  NavigationResult,
  RouteLocation,
} from "./types.js"
import { RouteMiddlewareHttpError } from "./types.js"
import { matchRoute } from "./manifest.js"
import {
  parseAppLocation,
  resolveInvalidLocaleRedirect,
  shouldRejectInvalidLocale,
  type AppPathSplitResult,
} from "./i18n/routing.js"
import { runEnterGuards, runGuards, toRedirect } from "./runNavigationGuards.js"
import { validateSearchForMatch } from "./validateSearchForMatch.js"
import { collectMiddlewareChain } from "./routeMeta.js"
import { ensureResolvedRouteLayersForMatch } from "./routeLayerResolution.js"
import { runRouteMiddleware, toMiddlewareRedirect } from "./routeMiddleware.js"
import {
  findMatchingInterceptor,
  type KiruHistoryInterceptState,
} from "./routeInterceptors.js"
import type { CommitKind, MachineEvent, NavIntent } from "./navigationMachine.js"
import {
  buildHistoryHref,
  buildMatchSegments,
  buildMiddlewareLocation,
  parseResolvedLocation,
  runTransition,
  type NavigationPipelineDeps,
  type NavigateInternalOptions,
} from "./navigation.js"

export type NavigationStep =
  | { kind: "event"; event: MachineEvent }
  | { kind: "awaitOutlet"; result: NavigationResult }
  | { kind: "redirect"; url: URL; options: NavigateInternalOptions }

export type NavigationWorkflowDeps = Omit<NavigationPipelineDeps, "fsm"> & {
  token: number
  signal: AbortSignal
  isStale: () => boolean
}

function finalizeNavigation(
  deps: NavigationWorkflowDeps,
  input: {
    to: RouteLocation
    from: RouteLocation | null
    failure?: NavigationFailure
  }
) {
  if (deps.isStale()) return
  deps.setLastNavigation(input)
  for (const hook of deps.afterEachHooks) {
    try {
      hook(input.to, input.from, input.failure)
    } catch {
      // afterEach must not break navigation
    }
  }
}

export async function* navigationWorkflow(
  targetUrl: URL,
  options: NavigateInternalOptions,
  deps: NavigationWorkflowDeps,
  transitionsEnabled: boolean
): AsyncGenerator<NavigationStep, NavigationResult, void> {
  const {
    manifest,
    resolvedPathPolicy,
    normalizedBaseUrl,
    origin,
    match,
    requestContext,
    leaveByRoute,
    updateByRoute,
    componentEnterGuards,
    history,
    historyIndex,
    saveScrollAt,
    commitLocation,
    setValidatedQuery,
    setValidatedRouteParams,
    locationFromMatch,
    snapshotFromParts,
    currentLocationParts,
    localeRouting,
    locale,
    onLocaleChange,
    setOutletRenderError,
    interceptorRegistrations,
    commitInterceptLocation,
    requestLimits = DEFAULT_REQUEST_LIMITS,
    token,
    signal,
    isStale,
  } = deps

  const {
    replace,
    fromPopstate,
    enableTransition = transitionsEnabled,
    intercept: allowIntercept = true,
  } = options

  const urlLimit = checkUrlWithinLimits(
    targetUrl.pathname,
    targetUrl.search,
    requestLimits
  )
  if (urlLimit) {
    if (__DEV__) {
      warnOnce(
        "nav-request-limit",
        `[kiru] navigation rejected: ${urlLimit.reason}`
      )
    }
    return { status: "cancelled" }
  }

  const resolved = localeRouting
    ? parseAppLocation(
        targetUrl,
        normalizedBaseUrl,
        localeRouting,
        resolvedPathPolicy,
        requestLimits
      )
    : parseResolvedLocation(targetUrl, normalizedBaseUrl, requestLimits)

  const invalidLocale = localeRouting
    ? (
        resolved as {
          invalidLocale?: Extract<
            AppPathSplitResult,
            { kind: "invalid-locale" }
          >
          wrongDomain?: Extract<AppPathSplitResult, { kind: "wrong-domain" }>
        }
      ).invalidLocale
    : undefined
  const wrongDomain = localeRouting
    ? (
        resolved as {
          wrongDomain?: Extract<AppPathSplitResult, { kind: "wrong-domain" }>
        }
      ).wrongDomain
    : undefined

  if (localeRouting && wrongDomain) {
    yield {
      kind: "redirect",
      url: new URL(wrongDomain.location),
      options: { replace: true, fromPopstate: false },
    }
    return { status: "cancelled" }
  }

  if (localeRouting && invalidLocale) {
    if (!shouldRejectInvalidLocale(localeRouting)) {
      const location = resolveInvalidLocaleRedirect(
        invalidLocale,
        localeRouting,
        resolvedPathPolicy,
        {
          host: targetUrl.host,
          protocol: targetUrl.protocol,
          baseUrl: normalizedBaseUrl,
        }
      )
      const target = location.startsWith("http")
        ? location
        : addBase(location, normalizedBaseUrl) +
          targetUrl.search +
          targetUrl.hash
      yield {
        kind: "redirect",
        url: new URL(target, origin),
        options: { replace: true, fromPopstate: false },
      }
      return { status: "cancelled" }
    }
  }

  if (localeRouting && locale && resolved.locale) {
    if (locale.peek() !== resolved.locale) {
      locale.value = resolved.locale
      onLocaleChange?.(resolved.locale)
    }
  }

  const targetPath = resolved.pathname
  const fromMatch = match.peek()
  const fromParts = currentLocationParts()
  const from = locationFromMatch(fromMatch)
  const toMatch = matchRoute(manifest, targetPath, resolvedPathPolicy)

  const to: RouteLocation = toMatch
    ? locationFromMatch(toMatch)!
    : { pathname: targetPath, params: {} }

  const toSnapshot = snapshotFromParts(
    {
      pathname: resolved.pathname,
      hash: resolved.hash,
      query: resolved.query,
    },
    toMatch?.params ?? {}
  )
  const fromSnapshotNav = fromMatch
    ? snapshotFromParts(fromParts, fromMatch.params)
    : null

  const intent: NavIntent = fromPopstate
    ? "popstate"
    : replace
      ? "replace"
      : "push"

  yield {
    kind: "event",
    event: {
      type: "NAV_REQUEST",
      id: token,
      intent,
      to: toSnapshot,
      from: fromSnapshotNav,
    },
  }

  let failure: NavigationFailure | undefined
  let navResult: NavigationResult = { status: "committed" }

  const abortNavigationWork = () => {
    if (!signal.aborted) {
      deps.navAbortController.current?.abort()
    }
  }

  const handlePopstateCancel = () => {
    if (!fromPopstate) return
    const restoreHref = buildHistoryHref(fromParts, normalizedBaseUrl)
    history.pushState(null, "", restoreHref)
    commitLocation(fromParts)
  }

  const yieldRedirect = function* (
    redirectTo: Parameters<typeof toRedirect>[0]
  ): Generator<NavigationStep, NavigationResult, void> {
    failure = { type: "redirect", to: redirectTo }
    finalizeNavigation(deps, { to, from, failure })
    const r = toRedirect(redirectTo)
    const nextUrl = r.path.includes("://")
      ? new URL(r.path)
      : new URL(r.path, origin)
    yield {
      kind: "redirect",
      url: nextUrl,
      options: { replace: r.replace ?? true, fromPopstate: false },
    }
    return { status: "cancelled" }
  }

  try {
    const isLeavingRoute =
      !!fromMatch && (!toMatch || fromMatch.route.id !== toMatch.route.id)
    const leaveList =
      isLeavingRoute && fromMatch
        ? leaveByRoute.get(fromMatch.route.id) ?? []
        : []
    if (leaveList.length) {
      const g0 = await runGuards(leaveList, to, from)
      if (g0.type === "cancel") {
        failure = { type: "cancelled" }
        abortNavigationWork()
        yield { kind: "event", event: { type: "VALIDATION_CANCEL" } }
        handlePopstateCancel()
        finalizeNavigation(deps, { to, from, failure })
        return { status: "cancelled" }
      }
      if (g0.type === "redirect") return yield* yieldRedirect(g0.to)
    }

    const isUpdatingRoute =
      !!fromMatch &&
      !!toMatch &&
      fromMatch.route.id === toMatch.route.id &&
      JSON.stringify(fromMatch.params) !== JSON.stringify(toMatch.params)
    const updateList =
      isUpdatingRoute && fromMatch
        ? updateByRoute.get(fromMatch.route.id) ?? []
        : []
    if (updateList.length) {
      const gu = await runGuards(updateList, to, from)
      if (gu.type === "cancel") {
        failure = { type: "cancelled" }
        abortNavigationWork()
        yield { kind: "event", event: { type: "VALIDATION_CANCEL" } }
        handlePopstateCancel()
        finalizeNavigation(deps, { to, from, failure })
        return { status: "cancelled" }
      }
      if (gu.type === "redirect") return yield* yieldRedirect(gu.to)
    }

    const isEnteringNewRoute =
      !fromMatch || !toMatch || fromMatch.route.id !== toMatch.route.id

    const fromSnapshot = fromMatch
      ? snapshotFromParts(fromParts, fromMatch.params)
      : null

    if (toMatch) {
      await ensureResolvedRouteLayersForMatch(toMatch)
    }
    if (toMatch && collectMiddlewareChain(toMatch).length > 0) {
      const segments = toMatch ? buildMatchSegments(toMatch) : []
      const mwTo = toMatch
        ? buildMiddlewareLocation(resolved, toMatch, segments)
        : {
            pathname: targetPath,
            params: {},
            query: resolved.query,
            hash: resolved.hash,
            href: resolved.href,
            routeId: "",
            meta: {},
            segments: [],
          }
      const mwFrom =
        fromMatch && fromSnapshot
          ? buildMiddlewareLocation(
              {
                pathname: fromParts.pathname,
                hash: fromParts.hash,
                query: fromParts.query,
                href: "",
              },
              fromMatch,
              buildMatchSegments(fromMatch)
            )
          : null
      if (mwFrom && !mwFrom.href) {
        mwFrom.href = buildHistoryHref(fromParts, normalizedBaseUrl)
      }
      const mw = await runRouteMiddleware({
        to: mwTo,
        from: mwFrom,
        context: requestContext.value,
        match: toMatch,
      })
      if (mw.type === "redirect") {
        return yield* yieldRedirect(toMiddlewareRedirect(mw.to))
      }
      if (mw.type === "abort") {
        failure = { type: "cancelled" }
        abortNavigationWork()
        yield { kind: "event", event: { type: "VALIDATION_CANCEL" } }
        handlePopstateCancel()
        finalizeNavigation(deps, { to, from, failure })
        return { status: "cancelled" }
      }
      if (mw.type === "error") {
        const err = new RouteMiddlewareHttpError(mw.status, mw.body)
        failure = { type: "error", error: err }
        if (isStale()) {
          abortNavigationWork()
          return { status: "cancelled" }
        }
        yield { kind: "event", event: { type: "VALIDATION_OK", commitKind: "error" } }
        if (replace) {
          saveScrollAt(historyIndex.value)
          history.replaceState(
            { ...history.state, index: historyIndex.value },
            "",
            resolved.href
          )
        } else {
          saveScrollAt(historyIndex.value)
          const nextIndex = historyIndex.value + 1
          deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
          history.pushState(
            { ...history.state, index: nextIndex },
            "",
            resolved.href
          )
          historyIndex.value = nextIndex
        }
        await runTransition(
          () => commitLocation(resolved),
          enableTransition,
          signal
        )
        setOutletRenderError?.(err)
        yield { kind: "event", event: { type: "COMMIT_ERROR" } }
        navResult = { status: "errored", error: err }
        finalizeNavigation(deps, { to, from, failure })
        yield { kind: "awaitOutlet", result: navResult }
        return navResult
      }
    }

    if (toMatch) {
      const searchCheck = await validateSearchForMatch(toMatch, resolved.query, {
        hash: resolved.hash,
      })
      if (!searchCheck.ok) {
        if (searchCheck.failure.kind === "redirect") {
          return yield* yieldRedirect(searchCheck.failure.location)
        }
        failure = { type: "cancelled" }
        abortNavigationWork()
        yield { kind: "event", event: { type: "VALIDATION_CANCEL" } }
        handlePopstateCancel()
        finalizeNavigation(deps, { to, from, failure })
        return { status: "cancelled" }
      }
      setValidatedQuery(searchCheck.validatedQuery ?? null)
      setValidatedRouteParams(searchCheck.params)
    } else {
      setValidatedQuery(null)
      setValidatedRouteParams(null)
    }

    if (isStale()) {
      abortNavigationWork()
      return { status: "cancelled" }
    }

    const interceptor =
      allowIntercept &&
      !fromPopstate &&
      fromMatch &&
      toMatch &&
      interceptorRegistrations &&
      commitInterceptLocation
        ? findMatchingInterceptor(
            interceptorRegistrations,
            fromMatch,
            toMatch
          )
        : null

    const commitKind: CommitKind = interceptor ? "intercept" : "hard"
    yield { kind: "event", event: { type: "VALIDATION_OK", commitKind } }

    if (interceptor && fromMatch && toMatch && commitInterceptLocation) {
      const commitIntercept = commitInterceptLocation
      const kiruIntercept: KiruHistoryInterceptState = {
        registrationId: interceptor.id,
        background: { ...fromParts },
        backgroundParams: { ...fromMatch.params },
      }
      if (replace) {
        saveScrollAt(historyIndex.value)
        history.replaceState(
          {
            ...history.state,
            index: historyIndex.value,
            kiruIntercept,
          },
          "",
          resolved.href
        )
      } else {
        saveScrollAt(historyIndex.value)
        const nextIndex = historyIndex.value + 1
        deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
        history.pushState(
          {
            ...history.state,
            index: nextIndex,
            kiruIntercept,
          },
          "",
          resolved.href
        )
        historyIndex.value = nextIndex
      }
      const interceptPayload = {
        id: token,
        registrationId: interceptor.id,
        background: fromMatch,
        target: toMatch,
      }
      yield {
        kind: "event",
        event: { type: "COMMIT_INTERCEPT", payload: interceptPayload },
      }
      await runTransition(
        async () => {
          await commitIntercept({
            target: resolved,
            targetMatch: toMatch,
            backgroundMatch: fromMatch,
            registration: interceptor,
            signal,
          })
        },
        enableTransition,
        signal
      )
      if (isStale()) {
        abortNavigationWork()
        return { status: "cancelled" }
      }
      navResult = { status: "intercepted" }
      finalizeNavigation(deps, { to, from, failure })
    } else {
      if (replace) {
        saveScrollAt(historyIndex.value)
        history.replaceState(
          {
            ...history.state,
            index: historyIndex.value,
            kiruIntercept: undefined,
          },
          "",
          resolved.href
        )
      } else {
        saveScrollAt(historyIndex.value)
        const nextIndex = historyIndex.value + 1
        deps.scrollStack.value = deps.scrollStack.value.slice(0, nextIndex)
        history.pushState(
          { ...history.state, index: nextIndex, kiruIntercept: undefined },
          "",
          resolved.href
        )
        historyIndex.value = nextIndex
      }
      await runTransition(
        () => commitLocation(resolved),
        enableTransition,
        signal
      )

      if (isEnteringNewRoute && componentEnterGuards.length) {
        await runEnterGuards(componentEnterGuards, to, from)
      }
      yield { kind: "event", event: { type: "COMMIT_HARD" } }
      navResult = { status: "committed" }
      finalizeNavigation(deps, { to, from, failure })
      yield { kind: "awaitOutlet", result: navResult }
    }
  } catch (error) {
    failure = { type: "error", error }
    navResult = { status: "errored", error }
    abortNavigationWork()
    yield { kind: "event", event: { type: "VALIDATION_CANCEL" } }
    handlePopstateCancel()
    finalizeNavigation(deps, { to, from, failure })
    return navResult
  }

  return navResult
}
