```jsx
import { createStore } from "kiru"

const useCountStore = createStore(0, (set, get) => ({
  increment: () => set((state) => state + 1),
  decrement: () => set((state) => state - 1),
  add: (value) => set(() => get() + value),
}))
```
