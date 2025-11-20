import { $FRAGMENT } from "./constants.js"
import { normalizeElementKey, normalizeElementRef } from "./utils/index.js"

export function createElement<T extends Kiru.VNode["type"]>(
  type: T,
  props: null | Record<string, unknown> = null,
  ...children: unknown[]
): Kiru.Element {
  if ((type as unknown) === Fragment) {
    type = $FRAGMENT as T
  }
  const p = props === null ? {} : props
  const ref = normalizeElementRef(type, p.ref)
  const key = normalizeElementKey(p.key)

  const len = children.length
  if (len === 1) {
    p.children = children[0]
  } else if (len > 1) {
    p.children = children
  }

  return {
    type,
    key,
    ref,
    props: p,
  }
}

export function Fragment({
  children,
  key,
}: {
  children: JSX.Children
  key?: JSX.ElementKey
}): Kiru.Element {
  return {
    type: $FRAGMENT,
    key: normalizeElementKey(key),
    ref: null,
    props: { children },
  }
}
