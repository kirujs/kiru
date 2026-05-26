import { signal, setup } from "kiru"

const showBadge = signal(true)
const initialCount = signal(0)

/** Fully static host subtree — lowered to `_template` when staticHoisting is on. */
const staticBadge = () => (
  <span className="badge" data-testid="static-badge">
    OK
  </span>
)

/** Mixed static + dynamic children — one holed template shell when staticHoisting is on. */
function MixedCounter() {
  const count = signal(0)
  return () => (
    <div data-testid="mixed-host">
      <span data-testid="mixed-static-a">static A</span>
      <span data-testid="mixed-dynamic">dynamic: {count}</span>
      <span data-testid="mixed-static-b">static B</span>
      <button
        type="button"
        data-testid="mixed-increment"
        onclick={() => count.set((c) => c + 1)}
      >
        mixed +
      </button>
    </div>
  )
}

function TwoHoleHost() {
  const value = signal(0)
  return () => (
    <div data-testid="two-hole-host">
      <input
        data-testid="two-hole-input"
        bind:value={value}
        type="number"
      />
      <section data-testid="two-hole-panel">value: {value}</section>
    </div>
  )
}

interface CounterProps {
  foo: { initialCount: number }
  items: number[]
}

/** Dynamic render tree — must stay on jsx + compile regions, not templates. */
const Counter: Kiru.Component<CounterProps> = () => {
  const { derive } = setup<typeof Counter>()
  const count = derive((props) => props.foo.initialCount)

  return (props) => (
    <div data-testid="counter">
      <p data-testid="counter-items">Items: {JSON.stringify(props.items)}</p>
      <h1 data-testid="counter-value">Count: {count}</h1>
      <button
        type="button"
        data-testid="counter-increment"
        onclick={() => count.set((c) => c + 1)}
      >
        Increment
      </button>
    </div>
  )
}

export function App() {
  return (
    <main id="compile-opts-root">
      <section aria-label="static badge" data-testid="badge-section">
        <button
          type="button"
          data-testid="badge-toggle"
          onclick={() => showBadge.set((v) => !v)}
        >
          toggle badge
        </button>
        {() => showBadge() && staticBadge()}
      </section>

      <section aria-label="mixed static slots" data-testid="mixed-section">
        <MixedCounter />
      </section>

      <section aria-label="two holes" data-testid="two-hole-section">
        <TwoHoleHost />
      </section>

      <section aria-label="dynamic counter" data-testid="counter-section">
        <label>
          initial
          <input
            data-testid="count-input"
            bind:value={initialCount}
            type="number"
          />
        </label>
        <Counter
          foo={{ initialCount: initialCount() }}
          items={[initialCount(), 2, 3]}
        />
      </section>
    </main>
  )
}
