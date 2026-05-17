import { defineHeadContent, serverLoader, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async (ctx) => ({
    source: "server",
    pathname: ctx.url.pathname,
  }),
  fallback: () => <p data-testid="loader-fallback">Loading...</p>,
})

export const head = defineHeadContent<typeof load>((_ctx, { data, error }) => ({
  title: error
    ? `Error: ${error.message}`
    : `${data!.source}@${data!.pathname}`,
}))

export default function LoadersServerPage({ data, error }: PageProps<typeof load>) {
  return (
    <p data-testid="loader-data">
      {error ? error.message : `${data.source}@${data.pathname}`}
    </p>
  )
}
