import { ElementProps } from "kiru"
import { H2 } from "../atoms/Heading"

export function Header({ children }: ElementProps<"div">) {
  return (
    <div className="mb-2 pb-2 border-b border-gray-500 flex justify-between items-center">
      <H2 className="text-xl">{children}</H2>
    </div>
  )
}
