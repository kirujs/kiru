import { signal } from "kiru"

export default function CounterPage() {
  const $toggled = signal(false)
  const $count = signal(0)

  return () => {
    const count = $count.value,
      toggled = $toggled.value

    return (
      <div id="counter">
        {/* used for checking that counter persists state after reordering these children */}
        {toggled && <p id="toggled">Toggled</p>}

        <button id="toggle" onclick={() => ($toggled.value = !$toggled.value)}>
          toggle
        </button>
        {count % 2 === 0 ? (
          <span data-even={true} data-test={true} id="count">
            {$count}
          </span>
        ) : (
          <span data-odd={true} data-test={true} id="count">
            {$count}
          </span>
        )}
        <button
          ariaLabel="increment"
          id="increment"
          onclick={() => $count.value++}
        >
          increment
        </button>
        {count > 0 && count % 2 === 0 && <p>count is even</p>}
      </div>
    )
  }
}
