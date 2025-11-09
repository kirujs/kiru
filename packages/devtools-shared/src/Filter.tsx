import { type ElementProps, type Signal, useId } from "kiru"
import { className as cls } from "kiru/utils"

type FilterProps = ElementProps<"div"> & {
  value: Signal<string>
}

export function Filter({ value, className, ...props }: FilterProps) {
  const id = useId()
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
        autocomplete={id + Math.random().toString(36).substring(2, 15)}
        name="filter-search"
        id="filter-search"
        bind:value={value}
      />
    </div>
  )
}
