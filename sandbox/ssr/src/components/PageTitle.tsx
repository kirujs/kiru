import { type ElementProps } from "kiru"

export function PageTitle({ className, children }: ElementProps<"h1">) {
  return <h1 className={`text-5xl ${className ?? ""}`}>{children}</h1>
}
