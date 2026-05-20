import { clientLoader, type PageProps } from "kiru/router"

export const load = clientLoader(async () => ({
  marker: "admin-loader-ran",
}))

export default function ContextAdminPage({ data }: PageProps<typeof load>) {
  return (
    <div data-testid="context-admin">
      <p data-testid="context-admin-secret">admin-area</p>
      <p data-testid="admin-loader-marker">{data?.marker}</p>
    </div>
  )
}
