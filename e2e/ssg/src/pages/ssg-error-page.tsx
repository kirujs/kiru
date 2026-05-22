export default function SsgErrorPage({ error }: { error: Error }) {
  return (
    <p data-testid="ssg-error-page">SSG error boundary: {error.message}</p>
  )
}
