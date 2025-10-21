import { useSignal } from "kiru"

export default function Counter() {
  console.log("Counter")
  const count = useSignal(0)

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
