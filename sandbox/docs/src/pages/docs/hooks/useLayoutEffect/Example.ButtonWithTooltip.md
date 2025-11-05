```jsx
import { useState, useRef } from "kiru"
import { Tooltip } from "./Tooltip"

export function ButtonWithTooltip({ children, tooltipContent, ...rest }) {
  const [targetRect, setTargetRect] = useState(null)
  const buttonRef = useRef(null)
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
