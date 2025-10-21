import { FLAG_STATIC_DOM } from "../constants.js"
import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import { renderMode } from "../globals.js"
import { useVNode } from "../hooks/utils.js"
import { nextIdle, requestUpdate } from "../scheduler.js"

interface PortalProps {
  children?: JSX.Children
  container: HTMLElement | (() => HTMLElement)
}

export function Portal({ children, container }: PortalProps) {
  const vNode = useVNode()
  if (!vNode.dom) {
    vNode.flags |= FLAG_STATIC_DOM
    switch (renderMode.current) {
      case "dom":
        vNode.dom = typeof container === "function" ? container() : container
        if (!(vNode.dom instanceof HTMLElement)) {
          if (__DEV__) {
            throw new KiruError({
              message: `Invalid portal container, expected HTMLElement, got ${vNode.dom}`,
              vNode: vNode,
            })
          }
          return null
        }
        return children
      case "hydrate":
        nextIdle(() => requestUpdate(vNode))
      case "stream":
      case "string":
        return null
    }
  }
  return children
}
