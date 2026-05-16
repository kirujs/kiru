export default function LeafErrorPage({ error }: { error: Error }) {
  return (
    <p data-testid="ssr-leaf-error-page">
      Leaf error: {error.message}
    </p>
  )
}
