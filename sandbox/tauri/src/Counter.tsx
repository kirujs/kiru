import { useState } from "kiru"

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex gap-2 items-center">
      <p>Count: {count}</p>
      <button
        onclick={() => setCount((prev) => prev + 1)}
        className="bg-primary hover:bg-primary-light text-white font-bold text-sm py-2 px-4 rounded"
      >
        Increment
      </button>
    </div>
  )
}
