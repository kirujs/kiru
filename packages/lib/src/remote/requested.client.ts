import { assertServerOnly } from "./serverOnly.js"

const REQUESTED_MSG =
  "`requested()` resolves client-posted query wire entries inside remote handlers on the server."

export function requested(
  _queryFn: unknown,
  _limit: number
): never {
  assertServerOnly("requested", REQUESTED_MSG)
}
