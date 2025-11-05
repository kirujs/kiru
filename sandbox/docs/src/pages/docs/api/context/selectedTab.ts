import { signal } from "kiru"

export const selectedTab = signal<
  "App" | "ThemeContext" | "ThemeContextProvider" | "Button"
>("App")
