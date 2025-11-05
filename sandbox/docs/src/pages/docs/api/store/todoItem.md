```jsx
function TodoItem({ id }) {
  const { value: todo, toggle } = useTodoStore((state) => {
    return state.find((item) => item.id === id)
  })
  // ...
}
```
