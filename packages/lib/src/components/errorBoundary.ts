import { $ERROR_BOUNDARY } from "../constants.js"
import { createElement } from "../index.js"

export interface ErrorBoundaryProps {
  children?: JSX.Children
  fallback?:
    | Exclude<JSX.Element, (props: any) => JSX.Element>
    | ((error: Error) => JSX.Element)
  onError?: (error: Error) => void
}

/**
 * Catches errors in the children and renders a fallback component.
 * @see https://kirujs.dev/docs/components/error-boundary
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return createElement($ERROR_BOUNDARY, props)
}
