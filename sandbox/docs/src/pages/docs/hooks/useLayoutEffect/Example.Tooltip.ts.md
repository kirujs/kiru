```tsx
import { useRef, useLayoutEffect, useState, Portal } from "kiru"
import { TooltipContainer } from "./TooltipContainer"

export function Tooltip({
  children,
  targetRect,
}: {
  children: JSX.Children
  targetRect: DOMRect
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const { height } = ref.current.getBoundingClientRect()
    setTooltipHeight(height)
    console.log("Measured tooltip height: " + height)
  }, [])

  let tooltipX = 0
  let tooltipY = 0
  if (targetRect !== null) {
    tooltipX = targetRect.left
    tooltipY = targetRect.top - tooltipHeight
    if (tooltipY < 0) {
      // It doesn't fit above, so place below.
      tooltipY = targetRect.bottom
    }
  }

  return (
    <Portal container={document.body}>
      <TooltipContainer x={tooltipX} y={tooltipY} contentRef={ref}>
        {children}
      </TooltipContainer>
    </Portal>
  )
}
```
