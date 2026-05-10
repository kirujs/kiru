import type {
  NavigationGuard,
  NavigationRedirect,
  RouteLocation,
} from "./types.js"

export function toRedirect(value: NavigationRedirect): {
  path: string
  replace?: boolean
} {
  if (typeof value === "string") return { path: value }
  return value
}

export async function runGuards(
  guards: NavigationGuard[],
  to: RouteLocation,
  from: RouteLocation | null
): Promise<
  | { type: "continue" }
  | { type: "cancel" }
  | { type: "redirect"; to: NavigationRedirect }
> {
  for (const guard of guards) {
    const out = await guard(to, from)
    if (out === false) return { type: "cancel" }
    if (out === true || out === undefined) continue
    return { type: "redirect", to: out }
  }
  return { type: "continue" }
}
