export default function CsrErrorPage({ error }: { error: Error }) {
  return (
    <p data-testid="csr-error-page">CSR error boundary: {error.message}</p>
  )
}
