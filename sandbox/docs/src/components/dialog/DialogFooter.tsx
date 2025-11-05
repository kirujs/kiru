import { ElementProps } from "kiru"

export function DialogFooter({
  children,
  className,
  ...rest
}: ElementProps<"div">) {
  return (
    <div
      className={`pt-2 border-t border-light border-opacity-15 flex justify-between items-center ${
        className || ""
      }`}
      {...rest}
    >
      {children}
    </div>
  )
}
