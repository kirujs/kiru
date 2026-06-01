"use dom"

import { For, mount, signal, type DomAppHandle } from "kiru/dom"

interface CounterItem {
  id: number
  count: number
}

export function mountKeyedList(container: HTMLElement): DomAppHandle {
  return mount(() => <KeyedListApp />, container)
}

function KeyedListApp() {
  const items = signal<CounterItem[]>([
    { id: 1, count: 0 },
    { id: 2, count: 0 },
    { id: 3, count: 0 },
  ])

  function moveUp(id: number) {
    const list = items()
    const index = list.findIndex((item) => item.id === id)
    if (index <= 0) return
    const next = [...list]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    items.set(next)
  }

  function moveDown(id: number) {
    const list = items()
    const index = list.findIndex((item) => item.id === id)
    if (index === -1 || index === list.length - 1) return
    const next = [...list]
    ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
    items.set(next)
  }

  return () => (
    <div id="keyed-list">
      <div
        className="keyed-list-inner"
        style="display: flex; flex-direction: column; gap: 0.5rem;"
      >
        <For each={items}>
          {(item) => (
            <>
              <p className="list-spacer">{item.id}</p>
              <div
                className="list-item"
                data-row-id={item.id}
                key={item.id}
                style="display: flex; gap: 0.5rem;"
              >
                <KeyedCounter item={item} />
                <div className="controls">
                  <button
                    className="move-up"
                    type="button"
                    onclick={() => moveUp(item.id)}
                  >
                    ↑
                  </button>
                  <button
                    className="move-down"
                    type="button"
                    onclick={() => moveDown(item.id)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            </>
          )}
        </For>
      </div>
    </div>
  )
}

function KeyedCounter(props: { item: CounterItem }) {
  const item = props.item
  const count = signal(item.count)

  return () => (
    <div className="counter-item" data-id={item.id}>
      <span className="counter-id">#{item.id}</span>
      <span className="counter-value">{count()}</span>
      <button
        className="increment"
        type="button"
        onclick={() => count.set((c) => c + 1)}
      >
        +
      </button>
      <button
        className="decrement"
        type="button"
        onclick={() => count.set((c) => c - 1)}
      >
        -
      </button>
    </div>
  )
}
