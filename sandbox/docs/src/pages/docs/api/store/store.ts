import { createStore } from "kiru"

export const useTabStore = createStore("store.ts", (set) => ({
  setSelected: (value: string) => set(value),
}))
