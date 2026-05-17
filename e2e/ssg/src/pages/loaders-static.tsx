import { staticLoader, type PageProps } from "kiru/router"

export const load = staticLoader(async () => ({
  source: "static",
  message: "prerendered loader data",
}))

export default function LoadersStaticPage({ data, error }: PageProps<typeof load>) {
  return (
    <p data-testid="loader-data">
      {error ? error.message : `${data.source}:${data.message}`}
    </p>
  )
}
