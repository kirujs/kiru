import * as kiru from "kiru"
import type { ElementProps } from "kiru"

export function ResizeGripIcon(props: ElementProps<"svg">) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      {...props}
    >
      <line
        x1="9"
        y1="1"
        x2="1"
        y2="9"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        x1="9"
        y1="5"
        x2="5"
        y2="9"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}
