import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import type { Orientation } from "../types"

export type SeparatorProps<AsChild extends boolean = false> = {
  orientation?: Orientation
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

interface SeparatorComponent {
  <AsChild extends boolean = false>(
    props: SeparatorProps<AsChild>
  ): (props: SeparatorProps<AsChild>) => JSX.Element
  displayName?: string
}

const Separator: SeparatorComponent = () => {
  const $ = Kiru.setup<typeof Separator>()

  const orientation = $.derive((p) => p.orientation ?? "horizontal")

  const attrs = {
    role: "separator",
    "aria-orientation": orientation,
    "data-orientation": orientation,
  }

  return ({ children, asChild, orientation: orientationProp, ...props }) => {
    void orientationProp
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...props, ...attrs } }
    }

    return (
      <div {...props} {...attrs}>
        {children}
      </div>
    )
  }
}

Separator.displayName = "Separator"

export { Separator }
