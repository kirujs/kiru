import { prepareRouteWithDocumentHead } from "./clientRoutePrep.js"
import { loadRouteTree, buildRoutedSubtree } from "./routeTree.js"
import type { Router } from "./csr.js"
import type { RouteManifest, CustomRequestContext } from "./types.js"
import { getRouterInstanceRuntime } from "./routerRuntime.js"
import {
  buildScopeCacheKey,
  createNavigationScope,
} from "./navigationScope.js"
import { formatRouterSearch } from "./navigation.js"
import { setBuildingInitialSsrOutlet } from "./pageData.js"

export async function buildInitialSsrOutletInShell(
  router: Router,
  _manifest: RouteManifest,
  _requestContext: CustomRequestContext
): Promise<JSX.Element | null> {
  const committedMatch = router.match.peek()
  if (!committedMatch) return null
  setBuildingInitialSsrOutlet(true)
  try {
    const { getNavGeneration } = getRouterInstanceRuntime(router)
    const abort = new AbortController()
    const scope = createNavigationScope(
      getNavGeneration(),
      abort.signal,
      buildScopeCacheKey(
        committedMatch.route.id,
        committedMatch.pathname,
        formatRouterSearch(router.query.peek())
      )
    )
    const tree = await loadRouteTree(committedMatch)
    const prepared = await prepareRouteWithDocumentHead({
      router,
      match: committedMatch,
      pageMod: tree.routeModule,
      routeModule: tree.routeModule,
      signal: abort.signal,
      scope,
      getNavGeneration,
      useHydratedPageData: true,
      forceReload: false,
    })
    if (prepared.discarded) return null
    return buildRoutedSubtree(
      tree.layoutModules,
      prepared.routeModule,
      prepared.leafProps,
      { match: committedMatch }
    )
  } finally {
    setBuildingInitialSsrOutlet(false)
  }
}
