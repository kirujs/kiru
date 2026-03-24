import { setRef } from "kiru/utils"

export type { Kiru as KiruGlobal }

export type HtmlOrSvgElement = HTMLElement | SVGElement
export type Orientation = "horizontal" | "vertical"

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

export function assignCustomStylePropertiesForSize(
  element: HtmlOrSvgElement,
  prefix: string
) {
  const { height, width } = element.getBoundingClientRect()
  element.style.setProperty(`--${prefix}-height`, `${height}px`)
  element.style.setProperty(`--${prefix}-width`, `${width}px`)
}
