import {
  defineHeadContent,
  serverLoader,
  type LoaderContext,
  type PageProps,
} from "kiru/router"

export const load = serverLoader({
  load: async (ctx: LoaderContext) => ({
    source: "server",
    pathname: ctx.url.pathname,
    locale: ctx.locale ?? "",
  }),
  fallback: () => <p data-testid="loader-fallback">Loading...</p>,
})

export const head = defineHeadContent<typeof load>(async (ctx) => {
  const { data, error } = await ctx.loader()
  return {
    title: error
      ? `Error: ${error.message}`
      : `${data!.source}@${data!.pathname}`,
  }
})

export default function LoadersServerPage({ data, error }: PageProps<typeof load>) {
  return (
    <p data-testid="loader-data">
      {error
        ? error.message
        : `${data.source}@${data.pathname}#${data.locale}`}
    </p>
  )
}
