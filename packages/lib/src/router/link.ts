import type { ElementProps } from "../types"
import { createElement } from "../element.js"
import { useCallback } from "../hooks/index.js"
import { useFileRouter } from "./context.js"

export interface LinkProps extends ElementProps<"a"> {
  /**
   * The path to navigate to
   * @example
   * <Link to="/about">About</Link>
   */
  to: string
  /**
   * Whether to replace the current history entry
   * @default false
   */
  replace?: boolean
  /**
   * Whether to trigger a view transition
   * @default false (overrides transition from config)
   */
  transition?: boolean
  /**
   * Whether to prefetch the route's javascript dependencies when hovered or focused
   * @default true
   */
  prefetchJs?: boolean
}

export const Link: Kiru.FC<LinkProps> = ({
  to,
  onclick,
  onmouseover,
  onfocus,
  replace,
  transition,
  prefetchJs,
  ...props
}) => {
  const { navigate, prefetchRouteModules, baseUrl } = useFileRouter()

  const handleMouseOver = useCallback(
    (e: Kiru.MouseEvent<HTMLAnchorElement>) => {
      if (prefetchJs !== false) {
        prefetchRouteModules(to)
      }
      onmouseover?.(e)
    },
    [onmouseover]
  )
  const handleFocus = useCallback(
    (e: Kiru.FocusEvent<HTMLAnchorElement>) => {
      if (prefetchJs !== false) {
        prefetchRouteModules(to)
      }
      onfocus?.(e)
    },
    [onfocus]
  )

  const handleClick = useCallback(
    (e: Kiru.MouseEvent<HTMLAnchorElement>) => {
      onclick?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      navigate(baseUrl + to, { replace, transition })
    },
    [onclick, navigate, to, replace, transition]
  )

  return createElement("a", {
    href: baseUrl + to,
    onclick: handleClick,
    onmouseover: handleMouseOver,
    onfocus: handleFocus,
    ...props,
  })
}
