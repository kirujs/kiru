```jsx
import { createContext, useContext } from "kiru"

const ThemeContext = useContext("light")

function App() {
  return (
    <ThemeContext.Provider value="light">
      <Button />
    </ThemeContext.Provider>
  )
}

function Button() {
  const theme = useContext(ThemeContext)

  return <button className={theme} />
}
```
