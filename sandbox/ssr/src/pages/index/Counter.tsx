import { useId, useSignal } from "kiru"

export default function Counter() {
  const id = useId()
  const count = useSignal(0)
  console.log("ran Counter component", id)
  return (
    <>
      <span>Count: {count}</span>{" "}
      <button
        onclick={() => count.value++}
        className="bg-primary hover:bg-primary-light text-white font-bold text-sm py-2 px-4 rounded"
      >
        Increment
      </button>
    </>
  )
}
