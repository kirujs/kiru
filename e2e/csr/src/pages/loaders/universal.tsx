import { loader, type PageProps } from "kiru/router"

export const load = loader(async () => ({
  source: "universal",
  message: "from loader",
}))

export default function UniversalLoaderPage({ data, error }: PageProps<typeof load>) {
  return (
    <div>
      <h2>Universal loader</h2>
      <p data-testid="loader-data">
        {error ? error.message : `${data.source}:${data.message}`}
      </p>
    </div>
  )
}
