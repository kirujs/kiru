```tsx
export function TooltipContainer({
  children,
  x,
  y,
  contentRef,
}: {
  children: JSX.Children
  x: number
  y: number
  contentRef: Kiru.Ref<HTMLDivElement | null>
}) {
  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "none",
        left: "0",
        top: "0",
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
    >
      <div ref={contentRef} className="tooltip">
        {children}
      </div>
    </div>
  )
}
```
