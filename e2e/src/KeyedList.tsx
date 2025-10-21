import { useState } from "kiru"

export function KeyedList() {
  const [counters, setCounters] = useState<string[]>(
    "abcdefghijklmnopqrstuvwxyz".split("")
  )

  const randomize = () => {
    const newCounters = [...counters]
    newCounters.sort(() => Math.random() - 0.5)
    setCounters(newCounters)
  }
  const remove = (id: string) => {
    setCounters(counters.filter((c) => c !== id))
  }

  return (
    <div id="keyed-list">
      <ul>
        {counters.map((c) => (
          <li key={"item-" + c} data-key={c} className="flex gap-2">
            <KeyedCounterItem id={c} remove={() => remove(c)} />
          </li>
        ))}
      </ul>

      <button id="randomize" onclick={randomize}>
        Randomize
      </button>
    </div>
  )
}

interface KeyedCounterProps {
  id: string
  remove: () => void
}

function KeyedCounterItem({ id, remove }: KeyedCounterProps) {
  const [count, setCount] = useState(0)
  return (
    <div>
      id : {id}
      <div className="flex gap-2 px-2 bg-black bg-opacity-30">
        <button
          className="increment btn btn-primary"
          onclick={() => setCount((c) => c + 1)}
        >
          {count}
        </button>
      </div>
      <button className="remove btn btn-primary" onclick={remove}>
        Remove
      </button>
    </div>
  )
}
