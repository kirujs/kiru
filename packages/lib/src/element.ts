import {
  $FRAGMENT,
  $STATIC_CHILDREN_LIST,
  FLAG_STATIC_CHILDREN,
} from "./constants.js"
import { normalizeElementKey } from "./utils/index.js"

function markStaticChildrenList(children: unknown) {
  if (Array.isArray(children)) {
    Object.defineProperty(children, $STATIC_CHILDREN_LIST, {
      value: true,
      enumerable: false,
    })
  }
}

export function createJsxElement(
  type: Kiru.Element["type"],
  props: Kiru.Element["props"] | null,
  key: JSX.ElementKey | undefined,
  staticChildren: boolean
): Kiru.Element {
  if ((type as unknown) === Fragment) {
    type = $FRAGMENT as Kiru.Element["type"]
  }
  const p: Record<string, unknown> =
    props === null ? {} : { ...props, ...(key !== undefined ? { key } : {}) }
  if (staticChildren) {
    markStaticChildrenList(p.children)
  }
  const el: Kiru.Element = {
    type,
    key: normalizeElementKey(p.key),
    props: p,
  }
  if (staticChildren) {
    el.meta = { flags: FLAG_STATIC_CHILDREN }
  }
  return el
}

export function createElement<T extends Kiru.VNode["type"]>(
  type: T,
  props: null | Record<string, unknown> = null,
  ...children: unknown[]
): Kiru.Element {
  if ((type as unknown) === Fragment) {
    type = $FRAGMENT as T
  }
  const p = props === null ? {} : props
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
    props: p,
  }
}

export function Fragment({
  children,
  key,
}: {
  children: JSX.Element
  key?: JSX.ElementKey
}): Kiru.Element {
  return {
    type: $FRAGMENT,
    key: normalizeElementKey(key),
    props: { children },
  }
}
