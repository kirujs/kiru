import { resource } from "../resource.js"
import { createElement } from "../element.js"
import { renderMode } from "../globals.js"
import { onMount } from "../hooks/onMount.js"
import { ErrorBoundary } from "../components/errorBoundary.js"
import {
  asClientOutletRouter,
  buildClientOutletSubtree,
} from "./clientRoutePrep.js"
import { renderClientErrorOutlet } from "./routeTree.js"
import { toRenderError } from "./types.js"
import { __DEV__ } from "../env.js"
import { warnRouterViewWithoutSsrBootstrap } from "./devWarnings.dev.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import { useRouter } from "./routerContext.js"
import { announceNavigationIfReady } from "./navigationAnnouncer.js"
import {
  canEndClientNavigation,
  tryClearClientNavigation,
} from "./outletNavigation.js"
import { bootstrapStreamedHydration } from "./pageData.js"
import { logOutletDebug, publishOutletState } from "./outletDebug.js"
import { resolveOutletDisplay } from "./resolveOutletDisplay.js"
import type { ClientRouteOutletProps } from "./clientRouteOutlet.types.js"

export type { ClientRouteOutletProps } from "./clientRouteOutlet.types.js"
export { resolveOutletDisplay, isSameCommittedMatch } from "./resolveOutletDisplay.js"

export function RouterView() {
  const router = useRouter()
  return createElement(ClientRouteOutlet, {
    manifest: router.manifest,
    mode: "csr",
  })
}

export function SsrClientOutlet(
  props: Omit<ClientRouteOutletProps, "mode">
) {
  return createElement(ClientRouteOutlet, { ...props, mode: "ssr-hydrate" })
}

export function ClientRouteOutlet({
  mode = "csr",
  initialSubtree,
  staticSubtree,
}: ClientRouteOutletProps) {
  if (
    staticSubtree !== undefined &&
    (renderMode.current === "stream" || renderMode.current === "string")
  ) {
    return () => staticSubtree
  }

  const router = useRouter()
  const isSsrHydrate = mode === "ssr-hydrate"
  const { match, loaderEpoch, outletRenderError } = router
  const { getNavGeneration } = getRouterInstanceRuntime(router)

  const hydrateGateOpenRef = {
    current: !isSsrHydrate || initialSubtree === undefined,
  }
  const useHydratedPageDataRef = { current: true }
  const outletRef = { value: initialSubtree ?? null }
  const displayedMatchRef = { current: router.match.peek() }
  const hydrateMatchRef = { current: router.match.peek() }

  function logLoadComplete(
    committedMatch: ReturnType<typeof router.match.peek>,
    subtree: JSX.Element | null,
    signal: AbortSignal
  ) {
    logOutletDebug("outlet:load:complete", {
      routeId: committedMatch?.route.id ?? null,
      subtree: subtree != null ? "ok" : "null",
      signalAborted: signal.aborted,
      navGen: getNavGeneration(),
    })
  }

  const children = resource({
    source: {
      match,
      loaderEpoch,
      outletRenderError,
    },
    load: async ({ match: committedMatch, outletRenderError: err }, { signal }) => {
      logOutletDebug("outlet:load:start", {
        mode,
        routeId: committedMatch?.route.id ?? null,
        pathname: router.pathname.peek(),
        hasErr: err != null,
        signalAborted: signal.aborted,
        navGen: getNavGeneration(),
        loaderEpoch: router.loaderEpoch.peek(),
      })

      if (!hydrateGateOpenRef.current && isSsrHydrate) {
        logOutletDebug("load:defer-bootstrap", {
          routeId: committedMatch?.route.id ?? null,
        })
        logOutletDebug("outlet:load:discarded", { reason: "defer-hydrate" })
        return initialSubtree ?? outletRef.value ?? null
      }

      if (err) {
        router.isLoaderPending.value = true
        try {
          const recovery = await renderClientErrorOutlet(
            router.manifest,
            committedMatch,
            err
          )
          if (recovery != null && !signal.aborted) {
            outletRef.value = recovery
            displayedMatchRef.current = committedMatch
          }
          logLoadComplete(committedMatch, recovery, signal)
          return recovery
        } finally {
          if (!signal.aborted) router.isLoaderPending.value = false
        }
      }

      router.isLoaderPending.value = true
      try {
        const intercept = router.interceptState.peek()
        const subtree = await buildClientOutletSubtree({
          router: asClientOutletRouter(router),
          match: committedMatch,
          pathname: intercept
            ? intercept.backgroundMatch.pathname
            : router.pathname.peek(),
          signal,
          getNavGeneration,
          useHydratedPageData: useHydratedPageDataRef.current,
          forceReload: router.forceLoaderReload.peek(),
          onLeafRenderError: isSsrHydrate
            ? (thrown) => {
                router.outletRenderError.value = toRenderError(thrown)
              }
            : undefined,
        })

        if (subtree != null && !signal.aborted) {
          outletRef.value = subtree
          displayedMatchRef.current = committedMatch
        }

        logLoadComplete(committedMatch, subtree, signal)
        return subtree
      } finally {
        if (!signal.aborted) router.isLoaderPending.value = false
      }
    },
  })

  function logPendingChange(pending: boolean) {
    const committed = router.match.peek()
    logOutletDebug("outlet:pending", {
      pending,
      isNavigating: router.isNavigating.peek(),
      routeId: committed?.route.id ?? null,
      contentNull: (children.value as JSX.Element | null) == null,
    })
  }

  function onPendingChange(pending: boolean) {
    logPendingChange(pending)
    if (!pending) {
      const ctrl = getRouterInstanceRuntime(router).getNavigationController?.()
      ctrl?.markOutletLoaded?.()
      const phase = ctrl?.getPhase()
      const fsmPhase = phase?.kind ?? null
      const fsmSub = phase && phase.kind === "navigating" ? phase.sub : null
      const accepted =
        ctrl?.notifyOutletSettled({
          pathname: router.pathname.peek(),
          matchParams: router.match.peek()?.params ?? {},
        }) ?? false
      logOutletDebug("outlet:settle:notify", {
        accepted,
        pathname: router.pathname.peek(),
        params: router.match.peek()?.params ?? {},
        fsmPhase,
        fsmSub,
      })
      if (accepted) {
        queueMicrotask(() => announceNavigationIfReady(router))
        return
      }
      const canEnd = canEndClientNavigation(router)
      logOutletDebug("outlet:settle:fallback", {
        canEnd,
        isNavigating: router.isNavigating.peek(),
      })
      if (router.isNavigating.peek() && canEnd) {
        tryClearClientNavigation(router)
        queueMicrotask(() => announceNavigationIfReady(router))
      }
    }
  }

  onMount(() => {
    if (__DEV__ && mode === "csr") warnRouterViewWithoutSsrBootstrap()

    if (isSsrHydrate && initialSubtree !== undefined) {
      queueMicrotask(() => {
        hydrateGateOpenRef.current = true
        bootstrapStreamedHydration({ seedKData: true })
        useHydratedPageDataRef.current = false
        children.refetch()
      })
    }

    const unsubOutletErr = router.outletRenderError.subscribe((err) => {
      if (err) children.refetch()
    })

    const unsubMatch = match.subscribe((nextMatch, prevMatch) => {
      const routeChanged =
        prevMatch?.route.id !== nextMatch?.route.id ||
        prevMatch?.pathname !== nextMatch?.pathname
      if (routeChanged && nextMatch) {
        hydrateMatchRef.current = nextMatch
      }
    })

    const unsubPending = children.isPending.subscribe(onPendingChange)
    onPendingChange(children.isPending.peek())

    return () => {
      unsubOutletErr()
      unsubMatch()
      unsubPending()
    }
  })

  return () => {
    const rawContent = (children.value as JSX.Element | null) ?? null
    const committed = router.match.peek()
    publishOutletState({
      resourcePending: children.isPending.peek(),
      resourceHasValue: rawContent != null,
      routeId: committed?.route.id ?? null,
      mode,
    })

    const content = resolveOutletDisplay({
      content: rawContent,
      isPending: children.isPending.peek(),
      committedMatch: committed,
      displayedMatch: displayedMatchRef.current,
      previousContent: outletRef.value,
      outletRenderError: outletRenderError.peek(),
      hydrateGateOpen: hydrateGateOpenRef.current,
      initialSubtree: isSsrHydrate ? initialSubtree : undefined,
      hydrateMatch: hydrateMatchRef.current,
    })

    if (outletRenderError.peek()) return content

    return createElement(ErrorBoundary, {
      fallback: (error: Error) => {
        logOutletDebug("outlet:errorBoundary", { message: error.message })
        outletRenderError.value = error
        return null
      },
      children: content,
    })
  }
}
