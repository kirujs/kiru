import { form, query } from "kiru/remote"

let counter = 0

export const counterQuery = query(async () => ({ count: counter }))

/** Bumps in-memory counter and patches {@link counterQuery} via server `.set()`. */
export const bumpCounter = form(async () => {
  counter += 1
  counterQuery.set({ count: counter })
  return { ok: true }
})
