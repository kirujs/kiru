import { ref, signal, onBeforeMount, onMount, onCleanup, Signal } from "kiru"

const tag = signal("")
export function App() {
  console.log("app mounted", tag.value)
  return () => (
    <div>
      <input bind:value={tag} />
      <Counter foo={tag} />
    </div>
  )
}

const createMousePosWatcher = () => {
  const pos = signal({ x: 0, y: 0 })
  const handleMouseMove = (e: MouseEvent) => {
    pos.value = { x: e.clientX, y: e.clientY }
  }
  window.addEventListener("mousemove", handleMouseMove)
  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove)
  })
  return pos
}

interface CounterProps {
  foo: Signal<string>
}

const Counter: Kiru.FC<CounterProps> = (props) => {
  const btnRef = ref<HTMLButtonElement>(null)
  const count = signal(0)
  const pos = createMousePosWatcher()

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

  console.log("initial render", props.foo)

  return ({ foo }) => {
    console.log("render", foo.value)
    console.log("pos", pos.value)

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
