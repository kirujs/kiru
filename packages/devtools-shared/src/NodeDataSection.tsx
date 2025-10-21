import { type ElementProps, useCallback, useEffect, useState } from "kiru"
import { ChevronIcon } from "./icons"

type NodeDataSectionProps = {
  title: string
  children: JSX.Children
  disabled?: boolean
} & ElementProps<"div">

export function NodeDataSection({
  title,
  children,
  className,
  disabled,
  ...rest
}: NodeDataSectionProps) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (!collapsed && disabled) setCollapsed(true)
  }, [disabled])

  const handleToggleCollapsed = useCallback((e: Event) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    setCollapsed((prev) => !prev)
  }, [])

  return (
    <div className="flex flex-col">
      <button
        onclick={handleToggleCollapsed}
        disabled={disabled}
        className={`${
          disabled ? "opacity-50 cursor-default" : "cursor-pointer"
        }`}
      >
        <span className="flex items-center gap-2 font-medium">
          <ChevronIcon
            className={`transition ${collapsed ? "" : "rotate-90"}`}
          />
          {title}
        </span>
      </button>
      {collapsed ? null : (
        <div className={`p-2 ${className || ""}`} {...rest}>
          {children}
        </div>
      )}
    </div>
  )
}
