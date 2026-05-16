export default function ScopeErrorPage({ error }: { error: Error }) {
  return (
    <p data-testid="ssr-error-page">
      SSR error boundary: {error.message}
    </p>
  )
}
