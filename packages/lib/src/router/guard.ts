import { NavigationHook } from "./types"
import { GuardModule } from "./types.internal"

export type GuardBeforeEach = NavigationHook<
  void | string | Promise<void | string>
>
export type GuardAfterEach = NavigationHook<void | Promise<void>>

export interface NavGuard {
  beforeEach: GuardBeforeEach
  afterEach: GuardAfterEach
}

export const $NAVGUARD_INTERNAL = Symbol.for("kiru:navguard")

export function resolveNavguard(module: GuardModule): NavGuard | null {
  if (
    "guard" in module &&
    $NAVGUARD_INTERNAL in ((module.guard ?? {}) as NavGuardBuilder)
  ) {
    return (module.guard as NavGuardBuilder)[$NAVGUARD_INTERNAL]
  }
  return null
}

export interface NavGuardBuilder {
  beforeEach(...fns: GuardBeforeEach[]): NavGuardBuilder
  afterEach(...fns: GuardAfterEach[]): NavGuardBuilder
  get [$NAVGUARD_INTERNAL](): NavGuard
}

function createNavGuard_impl(
  beforeEach: GuardBeforeEach[],
  afterEach: GuardAfterEach[]
): NavGuard {
  return {
    beforeEach: async (ctx, to, from) => {
      for (const fn of beforeEach) {
        const res = await fn(ctx, to, from)
        if (typeof res === "string") {
          return res
        }
      }
      return
    },
    afterEach: async (ctx, to, from) => {
      for (const fn of afterEach) {
        await fn(ctx, to, from)
      }
    },
  }
}

export function createNavGuard(): NavGuardBuilder {
  const beforeEach: GuardBeforeEach[] = []
  const afterEach: GuardAfterEach[] = []
  const guard = createNavGuard_impl(beforeEach, afterEach)

  return {
    beforeEach(...fns: GuardBeforeEach[]) {
      beforeEach.push(...fns)
      return this
    },
    afterEach(...fns: GuardAfterEach[]) {
      afterEach.push(...fns)
      return this
    },
    get [$NAVGUARD_INTERNAL]() {
      return guard
    },
  }
}
