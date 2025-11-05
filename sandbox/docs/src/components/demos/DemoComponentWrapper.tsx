import { ElementProps, unwrap } from "kiru"
import { className as cls } from "kiru/utils"

function classNameIncludes(
  className: ElementProps<"div">["className"],
  value: string
): boolean {
  return (unwrap(className) ?? "").indexOf(value) > -1
}

export function DemoComponentWrapper({
  children,
  className,
}: ElementProps<"div">) {
  const classIncludesPadding = classNameIncludes(className, " p-")
  return (
    <div
      className={cls(
        classIncludesPadding ? "" : "p-4",
        `bg-white/5 border border-white/5 shadow-[#0005] shadow-lg grow rounded-lg`,
        unwrap(className)
      )}
    >
      {children}
    </div>
  )
}
