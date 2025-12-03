import { Derive, ErrorBoundary, usePromise } from "kiru"
import { getCount, increment } from "./remote"

export default function ProtectedPage() {
  const countPromise = usePromise(() => getCount(), [])

  return (
    <ErrorBoundary fallback={(e) => <p>error: {String(e)}</p>}>
      <button onclick={() => countPromise.refresh(() => increment())}>
        Increment
        <Derive from={countPromise} fallback={<span>Loading...</span>}>
          {(count, isStale) => (
            <span className={isStale ? "opacity-50" : ""}>{count}</span>
          )}
        </Derive>
      </button>
    </ErrorBoundary>
  )
}
