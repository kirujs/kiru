import { $ERROR_BOUNDARY } from "../constants.js"
import { createElement } from "../index.js"

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
