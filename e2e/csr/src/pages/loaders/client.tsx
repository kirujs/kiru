import { clientLoader, type PageProps } from "kiru/router"

export const load = clientLoader(async () => ({
  source: "client",
  message: "from clientLoader",
}))

export default function ClientLoaderPage({ data, error }: PageProps<typeof load>) {
  return (
    <div>
      <h2>Client loader</h2>
      <p data-testid="loader-data">
        {error ? error.message : `${data.source}:${data.message}`}
      </p>
    </div>
  )
}

