```js
import { createContext } from "kiru"

export const ThemeContext = createContext({
  value: "light",
  toggle: () => {},
})
```
