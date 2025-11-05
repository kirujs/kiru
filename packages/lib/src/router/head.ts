import { __DEV__ } from "../env.js"
import { createElement } from "../index.js"
import { Signal } from "../signals/base.js"
import { isValidTextChild, isVNode } from "../utils/index.js"

export { HeadContent, HeadOutlet }

const validHeadChildren = ["title", "base", "link", "meta", "style", "script"]

function HeadContent({ children }: { children: JSX.Children }): JSX.Element {
  if (__DEV__) {
    const asArray = Array.isArray(children) ? children : [children]
    if (
      asArray.some(
        (c) =>
          !isVNode(c) ||
          typeof c.type !== "string" ||
          !validHeadChildren.includes(c.type)
      )
    ) {
      throw new Error(
        "[kiru/router]: <Head.Content> only accepts title, base, link, meta, style and script elements as children."
      )
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
