/** Dev-only SSR error boundary demo (not linked from main nav). */
export default function DevSsrErrorPage(): null {
  throw new Error("Intentional SSR render error for error boundary testing")
}
