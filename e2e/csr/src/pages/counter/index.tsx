import { signal } from "kiru"

export default function CounterPage() {
  const $toggled = signal(false)
  const $count = signal(0)

  return () => {
    return (
      <div id="counter">
        {/* used for checking that counter persists state after reordering these children */}
        {() => $toggled.value && <p id="toggled">Toggled</p>}

        <button id="toggle" onclick={() => ($toggled.value = !$toggled.value)}>
          toggle
        </button>
        {() => $count.value % 2 === 0 ? (
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
        {() => ($count.value > 0 && $count.value % 2 === 0) && <p>count is even</p>}
      </div>
    )
  }
}
