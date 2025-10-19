import { $ERROR_BOUNDARY } from "../constants.js"
import { createElement } from "../index.js"
import type { ErrorBoundaryNode } from "../types.utils"

export interface ErrorBoundaryProps {
  children?: JSX.Children
  fallback?: JSX.Element | ((error: Error) => JSX.Element)
  onError?: (error: Error) => void
}

export function ErrorBoundary({
  children,
  fallback,
  onError,
}: ErrorBoundaryProps) {
  return createElement($ERROR_BOUNDARY, { children, fallback, onError })
}

export function findParentErrorBoundary(
  vNode: Kiru.VNode
): ErrorBoundaryNode | null {
  let n = vNode.parent
  while (n) {
    if (n.type === $ERROR_BOUNDARY) return n as ErrorBoundaryNode
    n = n.parent
  }
  return null
}
