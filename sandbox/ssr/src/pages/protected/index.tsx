import { Derive, ErrorBoundary, usePromise } from "kiru"
import { getCount, increment } from "./remote"

export default function ProtectedPage() {
  const count = usePromise(() => getCount(), [])

  return (
    <ErrorBoundary
      fallback={(e) => (
        <>
          <p>error: {e.message}</p>
          <button onclick={() => count.refresh()}>Retry</button>
        </>
      )}
    >
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
