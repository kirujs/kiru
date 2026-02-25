import { ref, signal, onBeforeMount, onMount, onCleanup } from "kiru"

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

  const intervalId = setInterval(() => {
    count.value++
  }, 1000)

  onCleanup(() => {
    //console.log("cleanup")
    clearInterval(intervalId)
  })

  onBeforeMount(() => {
    console.log("counter before mounted", btnRef.current)
    return () => console.log("onBeforeMount: unmounted")
  })

  onMount(() => {
    console.log("counter mounted", btnRef.current)
    //return () => console.log("onMount: unmounted")
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
