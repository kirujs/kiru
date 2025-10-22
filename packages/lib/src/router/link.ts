import type { ElementProps } from "../types"
import { useFileRouter } from "./context.js"
import { createElement } from "../element.js"
import { useCallback } from "../hooks/index.js"

export interface LinkProps extends ElementProps<"a"> {
  to: string
  replace?: boolean
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
