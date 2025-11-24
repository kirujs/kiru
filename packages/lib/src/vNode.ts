import { $FRAGMENT } from "./constants.js"
import { Fragment } from "./element.js"

type VNode = Kiru.VNode

export function createVNode(
  type: VNode["type"],
  parent: VNode | null = null,
  props: VNode["props"] = {},
  key: VNode["key"] = null,
  index = 0
): VNode {
  if ((type as any) === Fragment) {
    type = $FRAGMENT
  }
  const depth = parent ? parent.depth + 1 : 0
  return {
    type,
    key,
    props,
    parent,
    index,
    depth,
    flags: 0,
    child: null,
    sibling: null,
    prev: null,
    deletions: null,
  }
}
