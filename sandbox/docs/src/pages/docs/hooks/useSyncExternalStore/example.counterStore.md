```jsx
let count = 0
const listeners = new Set()

export const counterStore = {
  // Function to get the current state
  getState: () => count,

  // Function to increment the counter
  increment: () => {
    count += 1
    listeners.forEach((listener) => listener())
  },

  // Function to subscribe to the store
  subscribe: (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener) // Return an unsubscribe function
  },
}
```
