import { useRouter } from "./routerContext.js"
import type { AppRoutePath, RouteParams } from "./routePaths.js"

/**
 * Typed route params for the active match. Pass the leaf logical path (e.g. `"/blog/[slug]"`).
 */
export function useParams<const P extends AppRoutePath>(): RouteParams<P> {
  const router = useRouter()
  return router.params() as RouteParams<P>
}
