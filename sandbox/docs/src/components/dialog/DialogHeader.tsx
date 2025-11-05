import { ElementProps } from "kiru"

export function DialogHeader({ children, className }: ElementProps<"div">) {
  return (
    <div
      className={`mb-2 pb-2 border-b border-light border-opacity-15 flex justify-between items-center ${
        className || ""
      }`}
    >
      {children}
    </div>
  )
}
