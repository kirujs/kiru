import { signal } from "kiru"

export const packageManagers = ["PNPM", "NPM", "Yarn", "Bun"] as const
type PackageManager = (typeof packageManagers)[number]

export const packageManager = signal<PackageManager>(packageManagers[0])
