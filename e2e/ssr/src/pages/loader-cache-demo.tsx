import { loader } from "kiru/router"

let counter = 0

export const load = loader({
  staleTime: 60_000,
  gcTime: 120_000,
  load: async () => {
    counter += 1
    return { count: counter, at: Date.now() }
  },
})

export default function LoaderCacheDemo({
  data,
}: {
  data: { count: number; at: number }
}) {
  return (
    <main>
      <h1>Loader cache demo</h1>
      <p data-testid="loader-cache-count">{data.count}</p>
      <p data-testid="loader-cache-at">{data.at}</p>
    </main>
  )
}
