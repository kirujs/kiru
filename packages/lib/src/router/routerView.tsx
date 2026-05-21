import { resource } from "../resource.js"
import { createElement } from "../element.js"
import { onMount } from "../hooks/onMount.js"
import { ErrorBoundary } from "../components/errorBoundary.js"
import {
  asClientOutletRouter,
  buildClientOutletSubtree,
} from "./clientRoutePrep.js"
import { renderClientErrorOutlet } from "./routeTree.js"
import { __DEV__ } from "../env.js"
import { warnRouterViewWithoutSsrBootstrap } from "./devWarnings.dev.js"
import { getRouterRuntime } from "./routerRuntime.js"
import { useRouter } from "./routerContext.js"

/**
 * CSR route outlet: loads the matched route tree on navigation.
 *
 * For SSR/SSG documents use `createRouterApp` from `kiru/router/ssr` or
 * `kiru/router/ssg` (or `bootstrapSsrClient` / `bootstrapSsgClient` from
 * `kiru/ssr/router`). `RouterView` alone does not preload the server route
 * subtree or serialized loader data required for hydration.
 */
export function RouterView() {
  const router = useRouter()
  const { match, pathname, loaderEpoch, outletRenderError } = router
  const { getNavGeneration } = getRouterRuntime(router)
  const children = resource(
    {
      match,
      pathname,
      loaderEpoch,
      outletRenderError,
      isNavigating: router.isNavigating,
      currentNavigation: router.currentNavigation,
    },
    async ({ match, pathname, outletRenderError: err }, { signal }) => {
      if (err) {
        router.isLoaderPending.value = true
        try {
          return await renderClientErrorOutlet(router.manifest, match, err)
        } finally {
          if (!signal.aborted) router.isLoaderPending.value = false
        }
      }
      router.isLoaderPending.value = true
      try {
        return await buildClientOutletSubtree({
          router: asClientOutletRouter(router),
          match,
          pathname,
          signal,
          getNavGeneration,
          useHydratedPageData: true,
          forceReload: router.forceLoaderReload.peek(),
        })
      } finally {
        if (!signal.aborted) {
          router.isLoaderPending.value = false
        }
      }
    }
  )

  onMount(() => {
    if (__DEV__) warnRouterViewWithoutSsrBootstrap()
    const canEndNavigation = () => {
      const nav = router.currentNavigation.peek()
      if (!nav?.to) return true
      if (pathname.peek() !== nav.to.pathname) return false
      const m = match.peek()
      if (!m) return true
      return JSON.stringify(m.params) === JSON.stringify(nav.to.params)
    }
    const onPendingChange = (pending: boolean) => {
      if (!pending && router.isNavigating.peek() && canEndNavigation()) {
        router.isNavigating.value = false
        router.currentNavigation.value = null
      }
    }
    const unsub = children.isPending.subscribe(onPendingChange)
    onPendingChange(children.isPending.peek())
    return unsub
  })

  return () => {
    const content = children.value
    if (outletRenderError.peek()) return content
    return createElement(ErrorBoundary, {
      fallback: (error: Error) => {
        outletRenderError.value = error
        return null
      },
      children: content,
    })
  }
}
