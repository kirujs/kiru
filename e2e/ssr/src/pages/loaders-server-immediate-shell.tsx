import { defineHeadContent, serverLoader, type PageProps } from "kiru/router"

export const load = serverLoader({
  load: async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return {
      source: "server",
      pathname: ctx.url.pathname,
    }
  },
  fallback: () => <p data-testid="loader-fallback">Loading...</p>,
})

export const head = defineHeadContent({
  title: "Server loader",
})

export default function LoadersServerPage({
  data,
  error,
}: PageProps<typeof load>) {
  return (
    <p data-testid="loader-data">
      {error ? error.message : `${data.source}@${data.pathname}`}
    </p>
  )
}
