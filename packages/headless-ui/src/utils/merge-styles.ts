import type { ElementProps, StyleObject } from "kiru"
import { styleObjectToString } from "kiru/utils"

export function mergeStyles(
  origin: StyleObject,
  styles: Exclude<ElementProps<"div">["style"], Kiru.Signal<any>>
): StyleObject | string {
  if (typeof styles === "string") {
    let prefix = styles.trimEnd()
    if (prefix[prefix.length - 1] !== ";") {
      prefix += ";"
    }
    return `${prefix}${styleObjectToString(origin)}`
  }
  if (typeof styles === "object" && !!styles) {
    return { ...styles, ...origin }
  }
  return origin
}
