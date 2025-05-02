import { Fragment, useState } from "kaioken"
import { Button } from "./atoms/Button"

export default function KeyedListExample() {
  const [counters, setCounters] = useState<number[]>([1, 2, 3, 4, 5])

  function move(id: number, dist: number) {
    const idx = counters.indexOf(id)
    if (idx + dist < 0 || idx + dist >= counters.length) return
    const newCounters = [...counters]
    newCounters.splice(idx, 1)
    newCounters.splice(idx + dist, 0, id)
    setCounters(newCounters)
  }

  function remove(id: number) {
    setCounters(counters.filter((c) => c !== id))
  }

  return (
    <ul>
      {counters.map((c) => (
        <Fragment key={"item-" + c}>
          <li className="flex gap-2">
            <KeyedCounterItem
              id={c}
              move={(dist) => move(c, dist)}
              remove={() => remove(c)}
            />
          </li>
        </Fragment>
      ))}
    </ul>
  )
}

interface KeyedCounterProps {
  id: number
  move: (dist: number) => void
  remove: () => void
}

function KeyedCounterItem({ id, move, remove }: KeyedCounterProps) {
  const [count, setCount] = useState(0)

  return (
    <>
      id : {id}
      <div className="flex gap-2 px-2 bg-black bg-opacity-30">
        <Button variant="primary" onclick={() => setCount((c) => c + 1)}>
          {count}
        </Button>
        <Button onclick={() => move(1)}>↓</Button>
        <Button onclick={() => move(2)}>↓↓</Button>
        <Button onclick={() => move(-1)}>↑</Button>
        <Button onclick={() => move(-2)}>↑↑</Button>
      </div>
      <button onclick={remove}>Remove</button>
    </>
  )
}
