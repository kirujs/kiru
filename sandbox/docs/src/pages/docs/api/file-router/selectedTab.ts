import { signal } from "kiru"

export const tabs = [
  "main",
  "pages/layout",
  "pages/index",
  "pages/[id]/index",
] as const

export const selectedTab = signal<(typeof tabs)[number]>("main")
