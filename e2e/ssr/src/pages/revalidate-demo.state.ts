const KEY = "__kiru_e2e_revalidate_generation__"

export function getRevalidateGeneration(): number {
  const g = globalThis as Record<string, unknown>
  if (typeof g[KEY] !== "number") g[KEY] = 1
  return g[KEY] as number
}

export function bumpRevalidateGeneration(): number {
  const next = getRevalidateGeneration() + 1
  ;(globalThis as Record<string, unknown>)[KEY] = next
  return next
}
