import { Signal } from "../signals/base.js"
import { isValidTextChild, isKiruNode } from "../utils/index.js"
import { createElement } from "../element.js"
import { __DEV__, isBrowser } from "../env.js"
import { KiruError } from "../error.js"
import { node } from "../globals.js"

export { HeadContent, HeadOutlet }

const validHeadChildren = ["title", "base", "link", "meta", "style", "script"]

function HeadContent({ children }: { children: JSX.Children }): JSX.Element {
  if (__DEV__) {
    const n = node.current!
    const asArray = Array.isArray(children) ? children : [children]
    const invalidNodes = asArray.filter(
      (c) =>
        !isKiruNode(c) ||
        typeof c.type !== "string" ||
        !validHeadChildren.includes(c.type)
    )
    if (invalidNodes.length) {
      throw new KiruError({
        message: `[kiru/router]: <Head.Content> only accepts title, base, link, meta, style and script elements as children. Received: ${invalidNodes.map(
          (n) => (isKiruNode(n) ? `<${n.type.toString()}>` : `"${n}"`)
        )}`,
        node: n,
      })
    }
  }
  if (isBrowser) {
    const asArray = Array.isArray(children) ? children : [children]
    const titleNode = asArray.find(
      (c) => isKiruNode(c) && c.type === "title"
    ) as Kiru.KiruNode

    if (titleNode) {
      const props = titleNode.props
      const titleChildren = Array.isArray(props.children)
        ? props.children
        : [props.children]

      document.title = titleChildren
        .map((c) => (Signal.isSignal(c) ? c.value : c))
        .filter(isValidTextChild)
        .join("")
    }

    return null
  }
  return createElement("kiru-head-content", { children })
}

function HeadOutlet(): JSX.Element {
  return createElement("kiru-head-outlet")
}
