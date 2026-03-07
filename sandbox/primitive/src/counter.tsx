import { computed, signal } from "kiru"

const x = signal(0)
const y = computed(() => {
  console.log("run y")
  return x.value * 2
})
debugger

y.subscribe((v) => console.log(v))

export const Counter = () => {
  const count = signal(0)
  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => count.value++}>Increment</button>
    </div>
  )
}
