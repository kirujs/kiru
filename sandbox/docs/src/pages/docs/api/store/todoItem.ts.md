```tsx
function TodoItem({ id }: { id: number }) {
  const { value: todo, toggle } = useTodoStore((state) => {
    return state.find((item) => item.id === id)
  })
  // ...
}
```
