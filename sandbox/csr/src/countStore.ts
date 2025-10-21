import { createStore } from "kiru"

export const countStore = createStore(0, (set, get) => ({
  increment: () => {
    set((count) => count + 1)
  },
  decrement: () => set((count) => count - 1),
  double: () => get() * 2,
  triple: () => get() * 3,
}))
