import {
  signal,
  computed,
  watch,
  useComputed,
  useSignal,
  For,
  Derive,
} from "kiru"
import { Route, Router, Link } from "kiru/router"

const count = signal(0, "count")
const isTracking = signal(true, "isTracking")

const double = computed(() => {
  if (isTracking.value) {
    console.log("hello world 123", count.value)
    return count.value * 2
  }
  return 0
}, "double")

const quadruple = computed(() => {
  console.log("quad 12345", count.value)
  return count.value * 4
}, "quadruple")

const watcher = watch([count], (count) => {
  console.log("count 123", count)
})

export default function SignalsExample() {
  return (
    <div>
      <nav className="flex gap-2 bg-transparent">
        <Link to="/" inherit className="underline">
          Global
        </Link>
        <Link to="/local" inherit className="underline">
          Local
        </Link>
      </nav>
      <div className="flex flex-col gap-2">
        <Router>
          <Route path="/" element={<GlobalComputedExample />} />
          <Route path="/local" element={<LocalComputedExample />} />
        </Router>
        <SignalExoticComponents />
      </div>
    </div>
  )
}

const GlobalComputedExample = () => {
  console.log("GlobalComputedExample")
  const onInc = async () => {
    count.value += 1
  }

  const onSwitch = () => {
    isTracking.value = !isTracking.value
    console.log("calling on switch method")
  }

  return (
    <div className="flex flex-col">
      <h1>count: {count}</h1>
      <h1>Double: {double}</h1>
      <h1>Quadruple: {quadruple}</h1>
      <h1>is tracking: {`${isTracking}`}</h1>

      <button className="mt-4 text-left" onclick={onInc}>
        Increment
      </button>
      <button className="text-left" onclick={onSwitch}>
        Switch tracking
      </button>
      <button className="text-left" onclick={() => watcher.start()}>
        start watcher
      </button>
      <button className="text-left" onclick={() => watcher.stop()}>
        stop watcher
      </button>
    </div>
  )
}

const LocalComputedExample = () => {
  const localCount = useSignal(0, "local count")
  const localIsTracking = useSignal(false, "local is tracking")
  const localDouble = useComputed(() => {
    if (localIsTracking.value) {
      return localCount.value * 100
    }

    return 0
  }, "local double")

  const localQuad = useComputed(() => {
    return localDouble.value * 2
  }, "local quadruble")

  const onInc = () => {
    localCount.value += 1
  }

  const onSwitch = () => {
    localIsTracking.value = !localIsTracking.value
  }

  return (
    <div className="flex flex-col">
      <h1>Count: {localCount}</h1>
      <h1>Double: {localDouble}</h1>
      <h1>Quadruple: {localQuad}</h1>
      <h1>is tracking: {`${localIsTracking}`}</h1>

      <button className="mt-4 text-left" onclick={onInc}>
        Increment
      </button>
      <button className="text-left" onclick={onSwitch}>
        Switch tracking
      </button>
    </div>
  )
}

function SignalExoticComponents() {
  return (
    <>
      <h1 className="text-2xl">Signal Exotics</h1>
      <ForExample />
      <DeriveExample />
    </>
  )
}

function ForExample() {
  const items = useSignal([0, 1, 2, 3, 4])
  const doubledItems = useComputed(() => items.value.map((i) => i * 2))
  return (
    <>
      <ul>
        <For each={doubledItems}>{(item) => <li>{item}</li>}</For>
      </ul>
      <button
        onclick={() => (items.value = [...items.value, items.value.length])}
      >
        Add
      </button>
    </>
  )
}

function DeriveExample() {
  const name = useSignal("bob")
  const age = useSignal(42)
  const person = useComputed(() => ({ name: name.value, age: age.value }))
  return (
    <div>
      <input bind:value={name} />
      <input type="number" bind:value={age} />
      <Derive from={person}>
        {(person) => (
          <div>
            {person.name} is {person.age} years old
          </div>
        )}
      </Derive>
    </div>
  )
}
