import { Derive, ErrorBoundary, usePromise, useSignal } from "kiru"
import { double, getCount, increment } from "./remote"

export default function ProtectedPage() {
  const count = usePromise(() => getCount(), [])
  const num = useSignal(0)

  return (
    <ErrorBoundary
      fallback={(e) => (
        <>
          <p>error: {e.message}</p>
          <button onclick={() => count.refresh()}>Retry</button>
        </>
      )}
    >
      <div>
        <input type="number" bind:value={num} />
        <button onclick={() => double(num.value).then((n) => (num.value = n))}>
          Double it!
        </button>
      </div>
      <button onclick={() => count.refresh(() => increment())}>
        Increment
        <Derive from={count} fallback={<span>Loading...</span>}>
          {(count, isStale) => (
            <span className={isStale ? "opacity-50" : ""}>{count}</span>
          )}
        </Derive>
      </button>
    </ErrorBoundary>
  )
}
