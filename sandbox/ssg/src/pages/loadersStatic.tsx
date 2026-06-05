import { staticLoader, type PageProps } from "kiru/router"

/** SSG demo: `staticLoader` — data is resolved at prerender and embedded in HTML. */
export const load = staticLoader(async () => ({
  builtAt: "build-time",
  message: "Baked into static HTML",
}))

export default function LoadersStaticPage({ data, error }: PageProps<typeof load>) {
  return (
    <div className="space-y-2">
      <p data-testid="loader-data">
        {error ? error.message : `${data.builtAt}: ${data.message}`}
      </p>
    </div>
  )
}
