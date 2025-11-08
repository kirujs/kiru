import { useState } from "kiru"
import { Head } from "kiru/router"

export default function CounterPage() {
  const [toggled, setToggled] = useState(false)
  return (
    <div>
      <Head.Content>
        <title>Counter</title>
      </Head.Content>
      {/* used for checking that counter persists state after reordering these children */}
      {toggled && <p>Toggled</p>}
      <ActualCounter />
      <button id="toggle-btn" onclick={() => setToggled(!toggled)}>
        toggle
      </button>
    </div>
  )
}

export const ActualCounter = () => {
  const [count, setCount] = useState(0)
  return (
    <div id="counter">
      {/** rendering.cy.ts - toggle attr check */}
      {count % 2 === 0 ? (
        <span data-even={true}>{count}</span>
      ) : (
        <span data-odd={true}>{count}</span>
      )}
      <button
        ariaLabel="increment"
        onclick={() => setCount((prev) => prev + 1)}
      >
        increment
      </button>
      {count > 0 && count % 2 === 0 && <p>count is even</p>}
    </div>
  )
}
