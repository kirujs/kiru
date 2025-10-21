import { type ElementProps, type Signal } from "kiru"
import { className as cls } from "./utils"

type FilterProps = ElementProps<"div"> & {
  value: Signal<string>
}

export function Filter({ value, className, ...props }: FilterProps) {
  return (
    <div
      className={cls(
        "w-full p-2 z-10",
        "bg-[#1d1d1d] border border-white border-opacity-10 rounded",
        className?.toString()
      )}
      {...props}
    >
      <input
        className={cls(
          "px-2 py-1 w-full rounded focus:outline focus:outline-primary",
          "bg-[#212121] border border-white border-opacity-10 rounded"
        )}
        placeholder="Filter..."
        type="text"
        bind:value={value}
      />
    </div>
  )
}
