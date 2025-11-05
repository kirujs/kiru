```tsx
import { useState, useRef, type ElementProps } from "kiru"
import { Tooltip } from "./Tooltip"

export function ButtonWithTooltip({
  children,
  tooltipContent,
  ...rest
}: ElementProps<"button"> & { tooltipContent: JSX.Element }) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        {...rest}
        ref={buttonRef}
        onpointerenter={() => {
          const rect = buttonRef.current.getBoundingClientRect()
          setTargetRect(rect)
        }}
        onpointerleave={() => {
          setTargetRect(null)
        }}
      >
        {children}
      </button>
      {targetRect !== null && (
        <Tooltip targetRect={targetRect}>{tooltipContent}</Tooltip>
      )}
    </>
  )
}
```
