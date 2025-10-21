import { ElementProps } from "kiru"

export function Container({
  className,
  children,
  ...props
}: ElementProps<"div">) {
  return (
    <div {...props} className={`mx-auto px-4 ${className || ""}`}>
      {children}
    </div>
  )
}
