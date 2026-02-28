import { signal } from "kiru"
import { Head } from "kiru/router"

export default function CounterPage() {
  const toggled = signal(false)
  return () => (
    <div>
      <Head.Content>
        <title>Counter</title>
      </Head.Content>
      {/* used for checking that counter persists state after reordering these children */}
      {toggled && <p>Toggled</p>}
      <ActualCounter />
      <button id="toggle-btn" onclick={() => (toggled.value = !toggled.value)}>
        toggle
      </button>
    </div>
  )
}

export const ActualCounter = () => {
  const count = signal(0)

  return (c = count.value) => (
    <div id="counter">
      {/** rendering.cy.ts - toggle attr check */}
      {c % 2 === 0 ? (
        <span data-even={true}>{count}</span>
      ) : (
        <span data-odd={true}>{count}</span>
      )}
      <button ariaLabel="increment" onclick={() => count.value++}>
        increment
      </button>
      {c > 0 && c % 2 === 0 && <p>count is even</p>}
    </div>
  )
}
