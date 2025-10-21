import { $FRAGMENT, $MEMO, FLAG_MEMO } from "./constants.js"
import { isMemoFn } from "./components/memo.js"
import { isValidElementKeyProp, isValidElementRefProp } from "./utils/index.js"

export function createElement<T extends Kiru.VNode["type"]>(
  type: T,
  props: null | Record<string, unknown> = null,
  ...children: unknown[]
): Kiru.VNode {
  if ((type as any) === Fragment) {
    return Fragment({ children: children as any, ...props })
  }
  const node: Kiru.VNode = {
    type,
    flags: 0,
    index: 0,
    depth: 0,
    props: {},
    parent: null,
    sibling: null,
    child: null,
    prev: null,
    deletions: null,
  }
  if (isMemoFn(type)) {
    node.flags |= FLAG_MEMO
    node.arePropsEqual = type[$MEMO].arePropsEqual
  }

  if (props !== null) {
    const { key, ref, ...rest } = props
    if (isValidElementKeyProp(key)) node.props.key = key.toString()
    if (isValidElementRefProp(ref)) node.props.ref = ref
    Object.assign(node.props, rest)
  }

  const _children =
    children.length === 1 ? children[0] : children.length > 1 ? children : null
  if (_children !== null) {
    node.props.children = _children
  }

  return node
}

export function Fragment({
  children,
  key,
}: {
  children: JSX.Children
  key?: JSX.ElementKey
}): Kiru.VNode {
  return createElement($FRAGMENT, key ? { key } : null, children)
}
