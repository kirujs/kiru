import { serverLoader, useRequestContext, type PageProps } from "kiru/router"

export const load = serverLoader(async (ctx) => ({
  loaderUser: ctx.context.user?.name ?? "none",
}))

export default function ContextConcurrencyPage({
  data,
}: PageProps<typeof load>) {
  const ctx = useRequestContext()
  return () => (
    <>
      <p data-testid="ctx-loader-user">{data?.loaderUser}</p>
      <p data-testid="ctx-hook-user">{ctx.user?.name ?? "none"}</p>
    </>
  )
}
