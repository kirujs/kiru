import { ElementProps } from "kiru"

export function PageTitle({ children, className = "" }: ElementProps<"h1">) {
  return <h1 className={`text-5xl ${className}`}>{children}</h1>
}
