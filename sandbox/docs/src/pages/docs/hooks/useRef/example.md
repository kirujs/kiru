```jsx
import { useRef } from "kiru"

function App() {
  const inputRef = useRef(null) // Create a ref for the input element

  const handleClick = () => {
    inputRef.current?.focus() // Access and focus the input element using the ref
  }

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onclick={handleClick}>Focus Input</button>
    </div>
  )
}
```
