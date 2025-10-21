import { ElementProps } from "kiru"

export function Backdrop({ children, ...props }: ElementProps<"div">) {
  return (
    <div {...props} className="backdrop">
      {children}
    </div>
  )
}
