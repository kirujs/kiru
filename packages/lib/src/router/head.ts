import { Signal } from "../signals/base.js"
import { isValidTextChild, isVNode } from "../utils/index.js"
import { createElement } from "../element.js"
import { __DEV__ } from "../env.js"
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
        !isVNode(c) ||
        typeof c.type !== "string" ||
        !validHeadChildren.includes(c.type)
    )
    if (invalidNodes.length) {
      throw new KiruError({
        message: `[kiru/router]: <Head.Content> only accepts title, base, link, meta, style and script elements as children. Received: ${invalidNodes.map(
          (n) => (isVNode(n) ? `<${n.type.toString()}>` : `"${n}"`)
        )}`,
        vNode: n,
      })
    }
  }
  if ("window" in globalThis) {
    const asArray = Array.isArray(children) ? children : [children]
    const titleNode = asArray.find(
      (c) => isVNode(c) && c.type === "title"
    ) as Kiru.VNode

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
