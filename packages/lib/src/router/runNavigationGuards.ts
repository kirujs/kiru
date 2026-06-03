import { __DEV__ } from "../env.js"
import { warnOnce } from "./devWarnings.dev.js"
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

/**
 * Post-commit enter hooks ({@link onAfterRouteEnter}). Return values are ignored;
 * `false` and redirects do not cancel or change navigation.
 */
export async function runEnterGuards(
  guards: NavigationGuard[],
  to: RouteLocation,
  from: RouteLocation | null
): Promise<void> {
  for (const guard of guards) {
    const out = await guard(to, from)
    if (!__DEV__) continue
    if (out === false) {
      warnOnce(
        "enter-guard-cancel-ignored",
        "`onAfterRouteEnter` runs after the navigation commits; returning `false` has no effect. Use `onBeforeRouteLeave` or route middleware to block navigation."
      )
    } else if (out !== true && out !== undefined) {
      warnOnce(
        "enter-guard-redirect-ignored",
        "`onAfterRouteEnter` runs after the navigation commits; returning a redirect has no effect. Use `onBeforeRouteLeave` or route middleware to redirect."
      )
    }
  }
}
