import { isElement } from "kiru/utils"

export function callEventHandler(
  props: { asChild?: boolean; children?: JSX.Children } & Record<string, any>,
  name: string,
  event: Omit<Event, "target" | "eventTarget"> & {
    eventTarget?: any
    target: any
  }
) {
  const { asChild, children } = props
  if (asChild && isElement(children)) {
    return children.props[name]?.(event)
  }
  return props[name]?.(event)
}
