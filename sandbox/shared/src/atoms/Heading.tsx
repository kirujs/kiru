import { ElementProps } from "kiru"

export function H1({ className, children, ...props }: ElementProps<"h1">) {
  return (
    <h1 className={"text-6xl font-bold " + (className || "")} {...props}>
      {children}
    </h1>
  )
}

export function H2({ className, children, ...props }: ElementProps<"h2">) {
  return (
    <h2 className={"text-5xl font-bold " + (className || "")} {...props}>
      {children}
    </h2>
  )
}

export function H3({ className, children, ...props }: ElementProps<"h3">) {
  return (
    <h3 className={"text-4xl font-bold " + (className || "")} {...props}>
      {children}
    </h3>
  )
}

export function H4({ className, children, ...props }: ElementProps<"h4">) {
  return (
    <h4 className={"text-3xl font-bold " + (className || "")} {...props}>
      {children}
    </h4>
  )
}

export function H5({ className, children, ...props }: ElementProps<"h5">) {
  return (
    <h5 className={"text-2xl font-bold " + (className || "")} {...props}>
      {children}
    </h5>
  )
}

export function H6({ className, children, ...props }: ElementProps<"h6">) {
  return (
    <h6 className={"text-xl font-bold " + (className || "")} {...props}>
      {children}
    </h6>
  )
}
