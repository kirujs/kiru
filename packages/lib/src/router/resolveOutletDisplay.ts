import type { RouteMatch } from "./types.js"

export function isSameCommittedMatch(
  current: RouteMatch | null,
  at: RouteMatch | null
): boolean {
  if (current === at) return true
  if (!current || !at) return false
  return (
    current.route.id === at.route.id && current.pathname === at.pathname
  )
}

export type ResolveOutletDisplayInput = {
  content: JSX.Element | null
  isPending: boolean
  committedMatch: RouteMatch | null
  displayedMatch: RouteMatch | null
  previousContent: JSX.Element | null
  outletRenderError: Error | null
  hydrateGateOpen: boolean
  initialSubtree: JSX.Element | null | undefined
  hydrateMatch: RouteMatch | null
}

/**
 * Pure display policy: SSR hydrate defer, stale-while-revalidate, error outlet.
 */
export function resolveOutletDisplay(
  input: ResolveOutletDisplayInput
): JSX.Element | null {
  const {
    content,
    isPending,
    committedMatch,
    displayedMatch,
    previousContent,
    outletRenderError,
    hydrateGateOpen,
    initialSubtree,
    hydrateMatch,
  } = input

  if (outletRenderError && content != null) {
    return content
  }

  if (!hydrateGateOpen && initialSubtree !== undefined) {
    if (
      initialSubtree != null &&
      isSameCommittedMatch(hydrateMatch, committedMatch)
    ) {
      return initialSubtree
    }
    if (previousContent && isSameCommittedMatch(displayedMatch, committedMatch)) {
      return previousContent
    }
    return initialSubtree ?? previousContent
  }

  if (
    content != null &&
    displayedMatch != null &&
    isSameCommittedMatch(displayedMatch, committedMatch)
  ) {
    return content
  }

  if (
    isPending &&
    previousContent != null &&
    displayedMatch != null &&
    isSameCommittedMatch(displayedMatch, committedMatch)
  ) {
    return previousContent
  }

  if (
    committedMatch != null &&
    displayedMatch != null &&
    !isSameCommittedMatch(displayedMatch, committedMatch)
  ) {
    return null
  }

  return content
}
