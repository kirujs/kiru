import { useSyncExternalStore } from "kiru"
import { myStore } from "./UseSyncExternalStoreExample.store"

export default function UseSyncExternalStoreExample() {
  const value = useSyncExternalStore(myStore.subscribe, myStore.get)
  return (
    <div>
      <h4>UseSyncExternalStoreExample</h4>
      <p>{value}</p>
      <button onclick={() => myStore.set(myStore.get() + 1)}>Increment</button>
    </div>
  )
}
