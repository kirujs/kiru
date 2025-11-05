import { ElementProps } from "kiru"

export function ChevronRightIcon(props: ElementProps<"svg">) {
  const { width, height, ...rest } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width ?? "1rem"}
      height={height ?? "1rem"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...rest}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
