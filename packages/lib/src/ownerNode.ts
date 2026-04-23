import { $FRAGMENT } from "./constants.js"
import { Fragment } from "./element.js"

type KiruNode = Kiru.KiruNode

export function createKiruNode(
  type: KiruNode["type"],
  parent: KiruNode | null = null,
  props: KiruNode["props"] = {},
  key: KiruNode["key"] = null,
  index = 0
): KiruNode {
  if (type === Fragment) {
    type = $FRAGMENT
  }

  return {
    type,
    key,
    props,
    parent,
    index,
  }
}
