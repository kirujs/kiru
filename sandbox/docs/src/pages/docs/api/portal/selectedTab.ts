import { signal } from "kiru"

export const selectedTab = signal<"App" | "index.html">("App")
