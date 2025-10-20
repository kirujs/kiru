import { createElement } from "../../element.js"
import {
  useState,
  useMemo,
  useContext,
  useLayoutEffect,
  useRef,
} from "../../hooks/index.js"
import { __DEV__ } from "../../env.js"
import { createContext } from "../../context.js"
import { isRoute, Route } from "./route.js"
import { noop } from "../../utils/index.js"
import { node } from "../../globals.js"
import type { ElementProps } from "../../types.js"
import { flushSync, nextIdle } from "../../scheduler.js"
import {
  parsePathParams,
  parseSearchParams,
  routeMatchesPath,
} from "./routerUtils.js"

export interface LinkProps extends Omit<ElementProps<"a">, "href"> {
  /**
   * The relative path to navigate to. If `inherit` is true,
   * the path will be relative to the parent <Route> component.
   */
  to: string
  /**
   * Event handler called when the link is clicked.
   * If you call `e.preventDefault()`, the navigation will not happen.
   */
  onclick?: (e: Event) => void
  /**
   * Specifies whether to replace the current history entry
   * instead of adding a new one.
   */
  replace?: boolean
  /**
   * If true, the path used for `to` will be relative to the parent <Route> component.
   * @default false
   */
  inherit?: boolean
}
export function Link({ to, onclick, replace, inherit, ...props }: LinkProps) {
  const router = useContext(RouterContext, false)

  const href = useMemo(() => {
    if (!inherit || router.isDefault) return to
    const parentPath = Object.entries(router.params).reduce(
      (acc, [k, v]) => acc.replace(`:${k}`, v),
      router.routePath
    )
    if (to === "/") return parentPath
    return (parentPath + to).replaceAll(/\/+/g, "/")
  }, [router.params, to, inherit])

  return createElement("a", {
    ...props,
    href,
    onclick: (e: Event) => {
      onclick?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      navigate(href, { replace })
    },
  })
}

type RouterCtx = {
  transitionsEnabled: boolean
  viewTransition: Kiru.RefObject<ViewTransition>
  queueSyncNav: (callback: () => void) => void
  params: Record<string, string>
  query: Record<string, string>
  routePath: string
  basePath?: string
  isDefault: boolean
}
const RouterContext = createContext<RouterCtx>({
  transitionsEnabled: false,
  viewTransition: { current: null },
  queueSyncNav: noop,
  params: {},
  query: {},
  routePath: "/",
  isDefault: true,
})
RouterContext.displayName = "Router"

function setQuery(query: Record<string, string>) {
  const url = new URL(window.location.href)
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  window.history.pushState({}, "", url.toString())
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
}

/**
 * Gets state and methods provided by a parent <Router>.
 *
 * @see https://kirujs.dev/docs/api/routing
 */
export function useRouter() {
  const { viewTransition, params, query } = useContext(RouterContext)
  return { viewTransition, params, query, setQuery }
}

export function navigate(to: string, options?: { replace?: boolean }) {
  const doNav = () => {
    window.history[options?.replace ? "replaceState" : "pushState"]({}, "", to)
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }))
  }
  // not called during render, just do the navigation
  if (!node.current) return doNav(), null

  const routerCtx = useContext(RouterContext, false)
  if (routerCtx.isDefault) {
    /**
     * called from a non-router-decendant - postpone
     * until next tick to avoid race conditions
     */
    return nextIdle(doNav), null
  }
  /**
   * set the value of our router's syncNavCallback,
   * causing it to be executed synchronously
   * during the router's useLayoutEffect.
   * consecutive calls to navigate will overwrite
   * the previous value.
   */
  return routerCtx.queueSyncNav(doNav), null
}

export interface RouterProps {
  /**
   * Base path for all routes in this router. Use this
   * to add a prefix to all routes
   */
  basePath?: string
  /**
   * Enable ViewTransition API for navigations
   */
  transition?: boolean
  /**
   * Children to render - the only supported children are <Route> components
   */
  children?: JSX.Children
}
const initLoc = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
})

/**
 * Main router component.
 *
 * @see https://kirujs.dev/docs/api/routing
 */
export function Router(props: RouterProps) {
  const viewTransition = useRef<ViewTransition | null>(null)
  const syncNavCallback = useRef<(() => void) | null>(null)
  const parentRouterContext = useContext(RouterContext, false)
  const dynamicParentPath = parentRouterContext.isDefault
    ? null
    : parentRouterContext.routePath
  const dynamicParentPathSegments = useMemo(
    () => dynamicParentPath?.split("/").filter(Boolean) || [],
    [dynamicParentPath]
  )

  const [loc, setLoc] = useState(initLoc)
  const query = useMemo(() => parseSearchParams(loc.search), [loc.search])
  const realPathSegments = useMemo(
    () => loc.pathname.split("/").filter(Boolean),
    [loc.pathname]
  )

  useLayoutEffect(() => {
    if (!parentRouterContext.isDefault) return

    const handler = () => {
      if (!document.startViewTransition || !props.transition) {
        return setLoc({
          pathname: window.location.pathname,
          search: window.location.search,
        })
      }

      viewTransition.current = document.startViewTransition(() => {
        setLoc({
          pathname: window.location.pathname,
          search: window.location.search,
        })
        flushSync()
      })
      viewTransition.current.finished.then(() => {
        viewTransition.current = null
      })
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])

  useLayoutEffect(() => {
    if (syncNavCallback.current) {
      syncNavCallback.current()
      syncNavCallback.current = null
    }
  })

  type RouteComponent = Kiru.VNode & {
    props: Kiru.InferProps<typeof Route>
  }
  let fallbackRoute: RouteComponent | undefined
  let route: RouteComponent | undefined
  const _children = (
    Array.isArray(props.children) ? props.children : [props.children]
  ).flat()

  for (const child of _children) {
    if (!isRoute(child)) continue

    if (child.props.path === "*") {
      if (__DEV__) {
        if (fallbackRoute) {
          console.warn(
            "[kiru]: More than one fallback route defined. Only the last one will be used."
          )
        }
      }
      fallbackRoute = child
      continue
    }
    const dynamicChildPathSegments = ((props.basePath || "") + child.props.path)
      .split("/")
      .filter(Boolean)
    if (
      routeMatchesPath(
        dynamicParentPathSegments.concat(dynamicChildPathSegments),
        realPathSegments,
        child.props.fallthrough
      )
    ) {
      route = child
      break
    }
  }

  let parsedParams = {}
  if (route) {
    const dynamicChildPathSegments = ((props.basePath || "") + route.props.path)
      .split("/")
      .filter(Boolean)
    parsedParams = parsePathParams(
      dynamicParentPathSegments.concat(dynamicChildPathSegments),
      realPathSegments
    )
  }
  const params = { ...parentRouterContext.params, ...parsedParams }

  return RouterContext.Provider({
    value: {
      params,
      query,
      routePath:
        (dynamicParentPath || "") +
        (props.basePath || "") +
        (route?.props.path || ""),
      basePath: props.basePath,
      isDefault: false,
      queueSyncNav: (callback: () => void) => {
        syncNavCallback.current = callback
      },
      viewTransition: viewTransition,
      transitionsEnabled: !!props.transition,
    },
    children: route ?? fallbackRoute ?? null,
  })
}
