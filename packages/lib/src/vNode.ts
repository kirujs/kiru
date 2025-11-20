import { $FRAGMENT } from "./constants.js"
import { Fragment } from "./element.js"

type VNode = Kiru.VNode

export function createVNode(
  type: VNode["type"],
  parent: VNode | null = null,
  props: VNode["props"] = {},
  ref: VNode["ref"] = null,
  key: VNode["key"] = null,
  index = 0
): VNode {
  if ((type as any) === Fragment) {
    type = $FRAGMENT
  }
  return {
    type,
    key,
    ref,
    props,
    parent,
    index,
    flags: 0,
    depth: parent ? parent.depth + 1 : 0,
    child: null,
    sibling: null,
    prev: null,
    deletions: null,
  }
}
