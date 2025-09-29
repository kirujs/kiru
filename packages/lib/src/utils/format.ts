import { unwrap } from "../signals/index.js"
import {
  booleanAttributes,
  REGEX_UNIT,
  snakeCaseAttributes,
} from "../constants.js"

export {
  className,
  encodeHtmlEntities,
  propFilters,
  propToHtmlAttr,
  styleObjectToString,
  propValueToHtmlAttrValue,
  propsToElementAttributes,
  safeStringify,
}

function className(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
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

      return snakeCaseAttributes.get(key) || key
  }
}

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
