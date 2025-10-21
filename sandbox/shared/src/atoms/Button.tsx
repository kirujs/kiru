import { type ElementProps } from "kiru"

type ButtonVariant = "primary" | "secondary" | "danger" | "success"

export function PrimaryButton({ className, ...props }: ElementProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-blue-500 hover:bg-blue-700 text-white font-bold text-sm py-2 px-4 rounded ${
        className || ""
      }`}
    >
      {props.children}
    </button>
  )
}

export function SecondaryButton({
  className,
  ...props
}: ElementProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-gray-500 hover:bg-gray-700 text-white font-bold text-sm py-2 px-4 rounded ${
        className || ""
      }`}
    >
      {props.children}
    </button>
  )
}

export function DangerButton({ className, ...props }: ElementProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-red-500 hover:bg-red-700 text-white font-bold text-sm py-2 px-4 rounded ${
        className || ""
      }`}
    >
      {props.children}
    </button>
  )
}

export function SuccessButton({ className, ...props }: ElementProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-green-500 hover:bg-green-700 text-white font-bold text-sm py-2 px-4 rounded ${
        className || ""
      }`}
    >
      {props.children}
    </button>
  )
}

export function DefaultButton({ className, ...props }: ElementProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-gray-200 hover:bg-gray-400 text-gray-800 font-bold text-sm py-2 px-4 rounded ${
        className || ""
      }`}
    >
      {props.children}
    </button>
  )
}

export function Button({
  variant,
  ...props
}: ElementProps<"button"> & { variant?: ButtonVariant }) {
  switch (variant) {
    case "primary":
      return <PrimaryButton {...props}>{props.children}</PrimaryButton>
    case "secondary":
      return <SecondaryButton {...props}>{props.children}</SecondaryButton>
    case "danger":
      return <DangerButton {...props}>{props.children}</DangerButton>
    case "success":
      return <SuccessButton {...props}>{props.children}</SuccessButton>
    default:
      return <DefaultButton {...props}>{props.children}</DefaultButton>
  }
}
