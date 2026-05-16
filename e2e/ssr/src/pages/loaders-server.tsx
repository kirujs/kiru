import { serverLoader, type PageProps } from "kiru/router"

export const load = serverLoader(async (ctx) => ({
  source: "server",
  pathname: ctx.url.pathname,
}))

export default function LoadersServerPage({ data, error }: PageProps<typeof load>) {
  return () => (
    <p data-testid="loader-data">
      {error ? error.message : `${data.source}@${data.pathname}`}
    </p>
  )
}
