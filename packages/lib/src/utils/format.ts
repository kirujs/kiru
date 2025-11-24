import { unwrap } from "../signals/utils.js"
import { booleanAttributes, snakeCaseAttributes } from "../constants.js"

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

const REGEX_AMP = /&/g
const REGEX_LT = /</g
const REGEX_GT = />/g
const REGEX_SQT = /'/g
const REGEX_DBLQT = /"/g
const REGEX_SLASH = /\//g
const REGEX_ALPHA_UPPER = /[A-Z]/g

function className(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

function encodeHtmlEntities(text: string): string {
  return text
    .replace(REGEX_AMP, "&amp;")
    .replace(REGEX_LT, "&lt;")
    .replace(REGEX_GT, "&gt;")
    .replace(REGEX_DBLQT, "&quot;")
    .replace(REGEX_SQT, "&#039;")
    .replace(REGEX_SLASH, "&#47;")
}

const internalProps = new Set(["children", "ref", "key", "innerHTML"])
const propFilters = {
  isInternalProp: (
    key: string
  ): key is "children" | "ref" | "key" | "innerHTML" => internalProps.has(key),
  isEvent: (key: string) => key.startsWith("on"),
  isStringRenderableProperty: (key: string) =>
    !internalProps.has(key) && !propFilters.isEvent(key),
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
    const cssKey = key.replace(REGEX_ALPHA_UPPER, "-$&").toLowerCase()
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

  const keys = Object.keys(rest).filter(propFilters.isStringRenderableProperty)
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
