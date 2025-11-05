import { ElementProps } from "kiru"
import { ExternalLinkIcon } from "../icons/ExternalLinkIcon"

export function ExternalLink({ children, ...props }: ElementProps<"a">) {
  return (
    <a target="_blank" className="link-ext" {...props}>
      {children}
      <ExternalLinkIcon />
    </a>
  )
}
