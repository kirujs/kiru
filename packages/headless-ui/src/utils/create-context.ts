import { createContext as createKiruContext, useContext } from "kiru"

const $DEFAULT = Symbol("unmatched")
export function createContext<T>(name: string) {
  const ctx = createKiruContext<T>($DEFAULT as T)
  ctx.displayName = name
  const use = () => {
    const c = useContext(ctx)
    if (c === $DEFAULT) {
      throw new Error(`Expected context "${name}" to be present`)
    }
    return c
  }
  return [ctx, use] as const
}
