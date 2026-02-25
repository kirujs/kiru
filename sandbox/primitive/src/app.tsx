import { ref, signal, onBeforeMount, onMount, onCleanup, Signal } from "kiru"

const tag = signal("")
export function App() {
  // const showCounter = signal(true)

  console.log("tag", tag.value)

  return () => (
    <div>
      <input bind:value={tag} />
      <Counter tag={tag.value} />
      {/* <button onclick={() => (showCounter.value = !showCounter.value)}>
        Toggle Counter
      </button>
      {showCounter.value && <Counter />} */}
    </div>
  )
}

interface CounterProps {
  tag: string
}
const Counter: Kiru.FC<CounterProps> = (props) => {
  const btnRef = ref<HTMLButtonElement>(null)
  const count = signal(0)
  {
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
  }

  console.log("initial tag", props.tag)

  return (newProps) => {
    console.log("render", newProps.tag)

    return (
      <div>
        <h1>Count: {count}</h1>
        <button ref={btnRef} onclick={() => count.value++}>
          Increment
        </button>
      </div>
    )
  }
}
