```tsx
import { useContext } from "kiru"
import { ThemeContext } from "./themeContext"

export function Button() {
  const { toggle } = useContext(ThemeContext)

  return <button onclick={toggle}>Toggle theme</button>
}
```
