import * as kiru from "kiru"
import type { ElementProps, StyleObject } from "kiru"

export interface SelectionBoxProps extends ElementProps<"div"> {
  style?: StyleObject
  top: number
  left: number
  width: number
  height: number
}

export function SelectionBox({
  style,
  top,
  left,
  width,
  height,
  ...props
}: SelectionBoxProps) {
  return (
    <div
      style={{
        ...style,
        position: "absolute",
        zIndex: 50,
        top: top + "px",
        left: left + "px",
        width: width + "px",
        height: height + "px",
        background:
          "linear-gradient(135deg, rgb(164 11 32 / 66%) 0%, rgb(82 14 47 / 80%) 80%)",
      }}
      {...props}
    />
  )
}
