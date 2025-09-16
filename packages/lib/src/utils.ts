import { node, renderMode } from "./globals.js"
import {
  $CONTEXT_PROVIDER,
  $FRAGMENT,
  $HYDRATION_BOUNDARY,
  booleanAttributes,
  FLAG_DELETION,
  FLAG_PLACEMENT,
  FLAG_UPDATE,
  REGEX_UNIT,
} from "./constants.js"
import { unwrap } from "./signals/utils.js"
import { __DEV__ } from "./env.js"
import type { AppContext } from "./appContext"

export {
  isVNode,
  isFragment,
  isLazy,
  isMemo,
  className,
  isContextProvider,
  isExoticType,
  isVNodeDeleted,
  vNodeContains,
  getCurrentVNode,
  getVNodeAppContext,
  commitSnapshot,
  traverseApply,
  findParent,
  propToHtmlAttr,
  propValueToHtmlAttrValue,
  propsToElementAttributes,
  styleObjectToString,
  shallowCompare,
  deepCompare,
  sideEffectsEnabled,
  encodeHtmlEntities,
  noop,
  latest,
  propFilters,
  safeStringify,
}

type VNode = Kiru.VNode

const noop: () => void = Object.freeze(() => {})

function className(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

/**
 * This is a no-op in production. It is used to get the latest
 * iteration of a component or signal after HMR has happened.
 */
function latest<T>(thing: T): T {
  let tgt: any = thing
  if (__DEV__) {
    while ("__next" in tgt) {
      tgt = tgt.__next as typeof tgt
    }
  }
  return tgt
}

/**
 * Returns false if called during "stream" or "string" render modes.
 */
function sideEffectsEnabled(): boolean {
  return renderMode.current === "dom" || renderMode.current === "hydrate"
}

function isVNodeDeleted(vNode: VNode): boolean {
  return (vNode.flags & FLAG_DELETION) !== 0
}

function isVNode(thing: unknown): thing is VNode {
  return typeof thing === "object" && thing !== null && "type" in thing
}

function isExoticType(type: VNode["type"]): type is Kiru.ExoticSymbol {
  return (
    type === $FRAGMENT ||
    type === $CONTEXT_PROVIDER ||
    type === $HYDRATION_BOUNDARY
  )
}

function isFragment(vNode: VNode): vNode is VNode & { type: typeof $FRAGMENT } {
  return vNode.type === $FRAGMENT
}

function isLazy(vNode: VNode): boolean {
  return (
    typeof vNode.type === "function" &&
    "displayName" in vNode.type &&
    vNode.type.displayName === "Kiru.lazy"
  )
}

function isMemo(vNode: Kiru.VNode): boolean {
  return (
    typeof vNode.type === "function" &&
    "displayName" in vNode.type &&
    vNode.type.displayName === "Kiru.memo"
  )
}

function isContextProvider(
  thing: unknown
): thing is VNode & { type: typeof $CONTEXT_PROVIDER } {
  return isVNode(thing) && thing.type === $CONTEXT_PROVIDER
}

function getCurrentVNode(): VNode | null {
  return node.current
}

function getVNodeAppContext(vNode: VNode): AppContext | null {
  let n: VNode | null = vNode
  while (n) {
    if (n.app) {
      return (vNode.app = n.app)
    }
    n = n.parent
  }

  return null
}

function commitSnapshot(vNode: VNode): void {
  const {
    props: { children, ...props },
    memoizedProps,
    index,
  } = vNode
  vNode.prev = { props, memoizedProps, index }
  vNode.flags &= ~(FLAG_UPDATE | FLAG_PLACEMENT | FLAG_DELETION)
}

function vNodeContains(haystack: VNode, needle: VNode): boolean {
  if (needle.depth < haystack.depth) return false
  if (haystack === needle) return true
  let checkSiblings = false
  const stack: VNode[] = [haystack]
  while (stack.length) {
    const n = stack.pop()!
    if (n === needle) return true
    n.child && stack.push(n.child)
    checkSiblings && n.sibling && stack.push(n.sibling)
    checkSiblings = true
  }
  return false
}

function traverseApply(vNode: VNode, func: (node: VNode) => void): void {
  func(vNode)
  let child = vNode.child
  while (child) {
    func(child)
    if (child.child) {
      traverseApply(child, func)
    }
    child = child.sibling
  }
}

function findParent(vNode: Kiru.VNode, predicate: (n: Kiru.VNode) => boolean) {
  let n: Kiru.VNode | null = vNode.parent
  while (n) {
    if (predicate(n)) return n
    n = n.parent
  }
  return null
}

function compare<T>(a: T, b: T, deep = false): boolean {
  // Fast path: identity comparison
  if (a === b) return true

  // Handle primitive types and null/undefined
  if (
    a == null ||
    b == null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false
  }

  // Handle arrays efficiently
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false

    if (deep) {
      for (let i = 0; i < a.length; i++) {
        if (!compare(a[i], b[i], true)) return false
      }
    } else {
      for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) return false
      }
    }
    return true
  }

  // Handle Maps
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false

    for (const [key, valueA] of a) {
      if (!b.has(key)) return false

      const valueB = b.get(key)
      if (deep) {
        if (!compare(valueA, valueB, true)) return false
      } else {
        if (!Object.is(valueA, valueB)) return false
      }
    }
    return true
  }

  // Handle Sets more efficiently
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false

    if (deep) {
      // For deep equality of Sets, we need to compare the values themselves
      // Convert to arrays and sort for comparison
      const aValues = Array.from(a)
      const bValues = Array.from(b)

      if (aValues.length !== bValues.length) return false

      // Simple compare doesn't work for objects in Sets with deep comparison
      // Using a matching algorithm instead
      for (const valueA of aValues) {
        // Find matching element in bValues
        let found = false
        for (let i = 0; i < bValues.length; i++) {
          if (compare(valueA, bValues[i], true)) {
            bValues.splice(i, 1) // Remove the matched element
            found = true
            break
          }
        }
        if (!found) return false
      }
      return true
    } else {
      // Regular Set comparison
      for (const valueA of a) {
        if (!b.has(valueA)) return false
      }
      return true
    }
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Handle RegExp objects
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString()
  }

  // Handle plain objects
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  // Use a Set for faster key lookup
  const keySet = new Set(keysB)

  for (const key of keysA) {
    if (!keySet.has(key)) return false

    const valueA = a[key as keyof T]
    const valueB = b[key as keyof T]

    if (deep) {
      if (!compare(valueA, valueB, true)) return false
    } else {
      if (!Object.is(valueA, valueB)) return false
    }
  }

  return true
}

function deepCompare<T>(a: T, b: T): boolean {
  return compare(a, b, true)
}

function shallowCompare<T>(a: T, b: T): boolean {
  return compare(a, b, false)
}

function encodeHtmlEntities(text: string): string {
  return text
    .replace(REGEX_UNIT.AMP_G, "&amp;")
    .replace(REGEX_UNIT.LT_G, "&lt;")
    .replace(REGEX_UNIT.GT_G, "&gt;")
    .replace(REGEX_UNIT.DBLQT_G, "&quot;")
    .replace(REGEX_UNIT.SQT_G, "&#039;")
    .replace(REGEX_UNIT.SLASH_G, "&#47;")
}

const propFilters = {
  internalProps: ["children", "ref", "key", "innerHTML"],
  isEvent: (key: string) => key.startsWith("on"),
  isProperty: (key: string) =>
    !propFilters.internalProps.includes(key) && !propFilters.isEvent(key),
}

function propToHtmlAttr(key: string): string {
  switch (key) {
    case "className":
      return "class"
    case "htmlFor":
      return "for"
    case "tabIndex":
    case "formAction":
    case "formMethod":
    case "formEncType":
    case "contentEditable":
    case "spellCheck":
    case "allowFullScreen":
    case "autoPlay":
    case "disablePictureInPicture":
    case "disableRemotePlayback":
    case "formNoValidate":
    case "noModule":
    case "noValidate":
    case "popoverTarget":
    case "popoverTargetAction":
    case "playsInline":
    case "readOnly":
    case "itemscope":
    case "rowSpan":
    case "crossOrigin":
      return key.toLowerCase()

    default:
      if (key.indexOf("-") > -1) return key
      if (key.startsWith("aria"))
        return "aria-" + key.substring(4).toLowerCase()

      return snakeCaseAttrs.get(key) || key
  }
}

const snakeCaseAttrs = new Map([
  ["acceptCharset", "accept-charset"],
  ["accentHeight", "accent-height"],
  ["alignmentBaseline", "alignment-baseline"],
  ["arabicForm", "arabic-form"],
  ["baselineShift", "baseline-shift"],
  ["capHeight", "cap-height"],
  ["clipPath", "clip-path"],
  ["clipRule", "clip-rule"],
  ["colorInterpolation", "color-interpolation"],
  ["colorInterpolationFilters", "color-interpolation-filters"],
  ["colorProfile", "color-profile"],
  ["colorRendering", "color-rendering"],
  ["dominantBaseline", "dominant-baseline"],
  ["enableBackground", "enable-background"],
  ["fillOpacity", "fill-opacity"],
  ["fillRule", "fill-rule"],
  ["floodColor", "flood-color"],
  ["floodOpacity", "flood-opacity"],
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontSizeAdjust", "font-size-adjust"],
  ["fontStretch", "font-stretch"],
  ["fontStyle", "font-style"],
  ["fontVariant", "font-variant"],
  ["fontWeight", "font-weight"],
  ["glyphName", "glyph-name"],
  ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
  ["glyphOrientationVertical", "glyph-orientation-vertical"],
  ["horizAdvX", "horiz-adv-x"],
  ["horizOriginX", "horiz-origin-x"],
  ["httpEquiv", "http-equiv"],
  ["imageRendering", "image-rendering"],
  ["letterSpacing", "letter-spacing"],
  ["lightingColor", "lighting-color"],
  ["markerEnd", "marker-end"],
  ["markerMid", "marker-mid"],
  ["markerStart", "marker-start"],
  ["overlinePosition", "overline-position"],
  ["overlineThickness", "overline-thickness"],
  ["paintOrder", "paint-order"],
  ["panose-1", "panose-1"],
  ["pointerEvents", "pointer-events"],
  ["renderingIntent", "rendering-intent"],
  ["shapeRendering", "shape-rendering"],
  ["stopColor", "stop-color"],
  ["stopOpacity", "stop-opacity"],
  ["strikethroughPosition", "strikethrough-position"],
  ["strikethroughThickness", "strikethrough-thickness"],
  ["strokeDasharray", "stroke-dasharray"],
  ["strokeDashoffset", "stroke-dashoffset"],
  ["strokeLinecap", "stroke-linecap"],
  ["strokeLinejoin", "stroke-linejoin"],
  ["strokeMiterlimit", "stroke-miterlimit"],
  ["strokeOpacity", "stroke-opacity"],
  ["strokeWidth", "stroke-width"],
  ["textAnchor", "text-anchor"],
  ["textDecoration", "text-decoration"],
  ["textRendering", "text-rendering"],
  ["transformOrigin", "transform-origin"],
  ["underlinePosition", "underline-position"],
  ["underlineThickness", "underline-thickness"],
  ["unicodeBidi", "unicode-bidi"],
  ["unicodeRange", "unicode-range"],
  ["unitsPerEm", "units-per-em"],
  ["vAlphabetic", "v-alphabetic"],
  ["vHanging", "v-hanging"],
  ["vIdeographic", "v-ideographic"],
  ["vMathematical", "v-mathematical"],
  ["vectorEffect", "vector-effect"],
  ["vertAdvY", "vert-adv-y"],
  ["vertOriginX", "vert-origin-x"],
  ["vertOriginY", "vert-origin-y"],
  ["wordSpacing", "word-spacing"],
  ["writingMode", "writing-mode"],
  ["xmlnsXlink", "xmlns:xlink"],
  ["xHeight", "x-height"],
])

function styleObjectToString(obj: Partial<CSSStyleDeclaration>): string {
  let cssString = ""
  for (const key in obj) {
    const cssKey = key.replace(REGEX_UNIT.ALPHA_UPPER_G, "-$&").toLowerCase()
    cssString += `${cssKey}:${obj[key]};`
  }
  return cssString
}

function stylePropToString(style: unknown) {
  if (typeof style === "string") return style
  if (typeof style === "object" && !!style) return styleObjectToString(style)
  return ""
}

function propValueToHtmlAttrValue(key: string, value: unknown): string {
  return key === "style" && typeof value === "object" && !!value
    ? styleObjectToString(value)
    : String(value)
}
function propsToElementAttributes(props: Record<string, unknown>): string {
  const attrs: string[] = []
  const { className, style, ...rest } = props
  if (className) {
    const val = unwrap(className)
    if (!!val) attrs.push(`class="${val}"`)
  }
  if (style) {
    const val = unwrap(style)
    if (!!val) attrs.push(`style="${stylePropToString(val)}"`)
  }

  const keys = Object.keys(rest).filter(propFilters.isProperty)
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i]
    let val = unwrap(props[k])
    if (val === null || val === undefined) continue

    k = k.split("bind:")[1] ?? k // normalize bind props
    const key = propToHtmlAttr(k)

    switch (typeof val) {
      case "function":
      case "symbol":
        continue
      case "boolean":
        if (booleanAttributes.has(key)) {
          if (val) attrs.push(key)
          continue
        }
    }
    attrs.push(`${key}="${val}"`)
  }
  return attrs.join(" ")
}

type SafeStringifyOptions = {
  /**
   * By default, functions are stringified. Specify `false` to instead produce `[FUNCTION (${fn.name})]`.
   */
  functions: boolean
}

function safeStringify(
  value: unknown,
  opts: SafeStringifyOptions = { functions: true }
): string {
  const seen = new WeakSet()
  return JSON.stringify(value, (_, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[CIRCULAR]"
      }
      seen.add(value)
    }
    if (typeof value === "function") {
      if (!opts.functions) return `[FUNCTION (${value.name || "anonymous"})]`
      return value.toString()
    }
    return value
  })
}
