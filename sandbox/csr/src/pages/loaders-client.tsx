import { clientLoader, type PageProps } from "kiru/router"

/** CSR demo: `clientLoader` + page props (load runs before mount). */
export const load = clientLoader(async () => ({
  label: "clientLoader",
  at: new Date().toISOString(),
}))

export default function LoadersClientPage({ data, error }: PageProps<typeof load>) {
  return () => (
    <div className="space-y-2 text-slate-700">
      <p data-testid="loader-data">
        {error ? error.message : `${data.label} @ ${data.at}`}
      </p>
    </div>
  )
}
