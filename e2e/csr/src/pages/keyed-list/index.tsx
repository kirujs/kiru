import { For, signal } from "kiru"

interface CounterItem {
  id: number
  count: number
}

function Counter({ item }: { item: CounterItem }) {
  const count = signal(item.count)

  return () => (
    <div className="counter-item" data-id={item.id}>
      <span
        className="counter-id"
        style="font-weight: bold; background: white; color: black;"
      >
        #{item.id}
      </span>
      <span className="counter-value">{count}</span>
      <button className="increment" onclick={() => count.value++}>
        +
      </button>
      <button className="decrement" onclick={() => count.value--}>
        -
      </button>
    </div>
  )
}

export default function KeyedListPage() {
  const items = signal<CounterItem[]>([
    { id: 1, count: 0 },
    { id: 2, count: 0 },
    { id: 3, count: 0 },
  ])

  function moveUp(index: number) {
    if (index === 0) return
    const newItems = [...items.value]
    ;[newItems[index - 1], newItems[index]] = [
      newItems[index],
      newItems[index - 1],
    ]
    items.value = newItems
  }

  function moveDown(index: number) {
    if (index === items.value.length - 1) return
    const newItems = [...items.value]
    ;[newItems[index], newItems[index + 1]] = [
      newItems[index + 1],
      newItems[index],
    ]
    items.value = newItems
  }

  return (
    <div id="keyed-list">
      <h2>Keyed List Test</h2>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <For each={items}>
          {(item, index) => (
            <div
              className="list-item"
              key={item.id}
              style="display: flex; gap: 0.5rem;"
            >
              <Counter item={item} />
              <div className="controls">
                <button
                  className="move-up"
                  data-index={index}
                  onclick={() => moveUp(index)}
                >
                  ↑
                </button>
                <button
                  className="move-down"
                  data-index={index}
                  onclick={() => moveDown(index)}
                >
                  ↓
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
