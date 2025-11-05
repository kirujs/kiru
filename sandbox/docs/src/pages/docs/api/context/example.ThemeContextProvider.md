```jsx
import { useState } from "kiru"
import { ThemeContext } from "./themeContext"

export function ThemeContextProvider({ children }) {
  const [theme, setTheme] = useState("light")

  return (
    <ThemeContext.Provider
      value={{
        value: theme,
        toggle: () => setTheme((prev) => (prev === "light" ? "dark" : "light")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
```
