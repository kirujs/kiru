import { effect, ref, signal, onBeforeMounted, onMounted } from "kiru"

export function App() {
  const showCounter = signal(true)

  return () => (
    <div>
      <button onclick={() => (showCounter.value = !showCounter.value)}>
        Toggle Counter
      </button>
      {showCounter.value && <Counter />}
    </div>
  )
}

function Counter() {
  const btnRef = ref<HTMLButtonElement>(null)
  const count = signal(0)

  effect(() => {
    console.log(count.value)
  })

  onBeforeMounted(() => {
    console.log("counter before mounted", btnRef.current)
  })

  onMounted(() => {
    console.log("counter mounted", btnRef.current)
    return () => console.log("unmounted")
  })

  return () => (
    <div>
      <h1>Count: {count}</h1>
      <button ref={btnRef} onclick={() => count.value++}>
        Increment
      </button>
    </div>
  )
}
