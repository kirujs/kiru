import { setRef } from "kiru/utils"
import type { HtmlOrSvgElement } from "./types"

export function createRefProxy<T>(callback: Kiru.RefCallback<T>) {
  let propsRef: Kiru.Ref<T> | undefined
  const ref: Kiru.RefCallback<T> = (value) => {
    callback(value)
    if (propsRef) {
      setRef(propsRef, value)
    }
  }
  const update = (props: Record<string, unknown>) => {
    if ("ref" in props) {
      if (propsRef !== props.ref && !!propsRef) {
        setRef(propsRef, null)
      }
      propsRef = props.ref as Kiru.Ref<T>
    } else if (propsRef) {
      setRef(propsRef, null)
      propsRef = undefined
    }
  }
  return { ref, update }
}

export function assignCustomStylePropertiesForSize(element: HtmlOrSvgElement) {
  const { height, width } = element.getBoundingClientRect()
  element.style.setProperty(`--content-height`, `${height}px`)
  element.style.setProperty(`--content-width`, `${width}px`)
}
