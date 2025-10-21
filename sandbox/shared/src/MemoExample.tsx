import { createContext, memo, useContext, useState } from "kiru"

type CountContextType = {
  count: number
  setCount: (value: Kiru.StateSetter<number>) => void
}
const CountContext = createContext<CountContextType>(null!)
const useCount = () => useContext(CountContext)

export default function MemoExample() {
  const [count, setCount] = useState(0)
  const [otherCount, setOtherCount] = useState(0)

  console.log("MemoExample")

  return (
    <>
      <button onclick={() => setOtherCount(otherCount + 1)}>
        other count: {otherCount}
      </button>
      <CountContext.Provider value={{ count, setCount }}>
        <Counter />
      </CountContext.Provider>
    </>
  )
}

const Counter = memo(function Counter() {
  console.log("Counter")
  return <CounterChild />
})

const CounterChild = memo(function CounterChild() {
  const { count, setCount } = useCount()
  console.log("CounterChild")
  return (
    <>
      <button onclick={() => setCount(count + 1)}>count: {count}</button>
    </>
  )
})
