const KEY = "__kiru_e2e_ppr_force_dynamic_hit__"

/** Incremented on each loader run (build prerender + each SSR request). */
export function nextForceDynamicHit(): number {
  const g = globalThis as Record<string, unknown>
  const n = Number(g[KEY] ?? 0) + 1
  g[KEY] = n
  return n
}
