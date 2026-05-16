import { serverLoader, type PageProps } from "kiru/router"

/** SSR demo: `serverLoader` — runs on the server; CSR navigations use RPC. */
export const load = serverLoader(async (ctx) => ({
  pathname: ctx.url.pathname,
  greeting: `Hello from serverLoader`,
}))

export default function LoadersServerPage({ data, error }: PageProps<typeof load>) {
  return () => (
    <div className="space-y-2">
      <p data-testid="loader-data">
        {error
          ? error.message
          : `${data.greeting} (${data.pathname})`}
      </p>
    </div>
  )
}
