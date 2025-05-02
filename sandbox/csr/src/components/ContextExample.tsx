import { createContext, useContext, useState } from "kaioken"

const ThemeContext = createContext<"light" | "dark">("dark")
ThemeContext.displayName = "ThemeContext"
const ThemeContextDispatcher = createContext<() => void>(() => {})
ThemeContextDispatcher.displayName = "ThemeContextDispatcher"

export default function ContextExample() {
  const [themeA, setThemeA] = useState<"light" | "dark">("light")
  const [themeB, setThemeB] = useState<"light" | "dark">("light")
  return (
    <div className="flex flex-col gap-2">
      <ThemeContext.Provider value={themeA}>
        {(t) => (
          <ThemeContextDispatcher.Provider
            value={() =>
              setThemeA((prev) => (prev === "light" ? "dark" : "light"))
            }
          >
            {(d) => <button onclick={d}>{t} (with props)</button>}
          </ThemeContextDispatcher.Provider>
        )}
      </ThemeContext.Provider>
      <br />
      <ThemeContext.Provider value={themeB}>
        <ThemeContextDispatcher.Provider
          value={() =>
            setThemeB((prev) => (prev === "light" ? "dark" : "light"))
          }
        >
          <ThemeButton />
        </ThemeContextDispatcher.Provider>
      </ThemeContext.Provider>
    </div>
  )
}

function ThemeButton() {
  const theme = useContext(ThemeContext)
  const dispatch = useContext(ThemeContextDispatcher)
  return <button onclick={() => dispatch()}>{theme}</button>
}
