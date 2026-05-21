import type { RouteParams, HasRouteParams } from "../../router/routePaths.js"

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false

export type RoutePathChecks = [
  Expect<Equal<RouteParams<"/">, {}>>,
  Expect<Equal<RouteParams<"/about">, {}>>,
  Expect<Equal<RouteParams<"/blog/[slug]">, { slug: string }>>,
  Expect<Equal<RouteParams<"/docs/[...slug]">, { slug: string }>>,
  Expect<Equal<RouteParams<"/items/[[id]]">, { id?: string }>>,
  Expect<Equal<HasRouteParams<"/about">, false>>,
  Expect<Equal<HasRouteParams<"/blog/[slug]">, true>>,
]



type AssertAllTrue<T extends readonly true[]> = T
export type RoutePathChecksOk = AssertAllTrue<RoutePathChecks>
