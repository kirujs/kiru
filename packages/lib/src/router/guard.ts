import { GuardModule } from "./types.internal"

export type GuardBeforeEach = (
  path: string,
  context: Kiru.RequestContext
) => void | string | Promise<void | string>
export type GuardAfterEach = (to: string, from: string) => void | Promise<void>

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

export function createNavGuard(): NavGuardBuilder {
  const beforeEach: GuardBeforeEach[] = []
  const afterEach: GuardAfterEach[] = []
  const guard: NavGuard = {
    beforeEach: async (path, ctx) => {
      for (const fn of beforeEach) {
        const res = await fn(path, ctx)
        if (typeof res === "string") {
          return res
        }
      }
      return
    },
    afterEach: async (to, from) => {
      for (const fn of afterEach) {
        await fn(to, from)
      }
    },
  }

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
