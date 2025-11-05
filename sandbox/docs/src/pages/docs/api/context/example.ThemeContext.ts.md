```ts
import { createContext } from "kiru"

export const ThemeContext = createContext({
  value: "light" as "light" | "dark",
  toggle: () => {},
})
```
