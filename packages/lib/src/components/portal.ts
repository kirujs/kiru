import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import { node, renderMode } from "../globals.js"
import { nextIdle, requestUpdate } from "../scheduler.js"

interface PortalProps {
  children?: JSX.Children
  container: HTMLElement | (() => HTMLElement)
}

/**
 * Escapes the application DOM tree and renders a child component in the given container.
 * @see https://kirujs.dev/docs/components/portal
 */
export function Portal({ children, container }: PortalProps) {
  const thisNode = node.current!
  if (!thisNode.dom) {
    switch (renderMode.current) {
      case "dom":
        thisNode.dom = typeof container === "function" ? container() : container
        if (!(thisNode.dom instanceof HTMLElement)) {
          if (__DEV__) {
            throw new KiruError({
              message: `Invalid portal container, expected HTMLElement, got ${thisNode.dom}`,
              node: thisNode,
            })
          }
          return null
        }
        return children
      case "hydrate":
        nextIdle(() => requestUpdate(thisNode))
      case "stream":
      case "string":
        return null
    }
  }
  return children
}
