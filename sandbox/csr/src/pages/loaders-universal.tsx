import { loader, type PageProps } from "kiru/router"

/** CSR demo: universal `loader` (runs on the client in CSR-only apps). */
export const load = loader(async () => ({
  label: "loader",
  note: "Runs on the client in this sandbox",
}))

export default function LoadersUniversalPage({ data, error }: PageProps<typeof load>) {
  return (
    <div className="space-y-2 text-slate-700">
      <p data-testid="loader-data">
        {error ? error.message : `${data.label} — ${data.note}`}
      </p>
    </div>
  )
}
