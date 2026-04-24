import { onMount, ref, signal } from "kiru"

const initialCount = signal(0)
const inputRef = ref<HTMLInputElement>(null)
export function App() {
  onMount(() => {
    console.log(inputRef.current)
  })
  return (
    <>
      <input ref={inputRef} bind:value={initialCount} type="number" />
      {(v = initialCount.value) => (isNaN(v) ? 0 : v * 5)}
      {/* <Counter count={initialCount} /> */}
    </>
  )
}

// interface CounterProps {
//   count: Kiru.Signal<number>
//   depth?: number
// }

// const Counter: Kiru.FC<CounterProps> = () => {
//   const { derive, props, id } = setup<typeof Counter>()
//   const count = derive((props) => unwrap(props.count, true))

//   return () => (
//     <div>
//       <h1>
//         Count: {count} {id}
//       </h1>
//       <button onclick={() => count.value++}>Increment</button>
//       {!props.depth || props.depth < 25 ? (
//         <Counter depth={(props.depth ?? 0) + 1} count={count} />
//       ) : null}
//     </div>
//   )
// }
