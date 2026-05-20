import { loader, type PageProps } from "kiru/router"

export const load = loader(async () => {
  throw new Error("e2e-csr-loader-boom")
})

export default function CsrBreakLoaderPage({ error }: PageProps<typeof load>) {
  return error ? (
    <p data-testid="csr-loader-error">Loader error: {error.message}</p>
  ) : (
    <p data-testid="csr-break-loader-page">should not render</p>
  )
}
