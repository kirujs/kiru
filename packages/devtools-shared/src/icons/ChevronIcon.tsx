import type { ElementProps } from "kiru"

export function ChevronIcon(props: ElementProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1rem"
      height="1rem"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
