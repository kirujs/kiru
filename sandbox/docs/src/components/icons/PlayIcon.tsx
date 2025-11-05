import { ElementProps } from "kiru"

export function PlayIcon(props: ElementProps<"svg">) {
  const { width, height, ...rest } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width ?? 24}
      height={height ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...rest}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
