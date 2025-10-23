import type { ElementProps } from "../types"
import { createElement } from "../element.js"
import { useCallback } from "../hooks/index.js"
import { useFileRouter } from "./context.js"

export interface LinkProps extends ElementProps<"a"> {
  /**
   * The path to navigate to
   */
  to: string
  /**
   * Whether to replace the current history entry
   */
  replace?: boolean
  /**
   * Whether to trigger a view transition
   */
  transition?: boolean
}

export const Link: Kiru.FC<LinkProps> = ({
  to,
  onclick,
  replace,
  transition,
  ...props
}) => {
  const { navigate } = useFileRouter()

  const handleClick = useCallback(
    (e: Kiru.MouseEvent<HTMLAnchorElement>) => {
      onclick?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      navigate(to, { replace, transition })
    },
    [to, navigate, onclick, replace]
  )

  return createElement("a", { href: to, onclick: handleClick, ...props })
}
