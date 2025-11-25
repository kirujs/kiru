import { Derive, usePromise, useSignal } from "kiru"
import { Head } from "kiru/router"
import { client } from "@/api"

export default function StreamingPage() {
  const count = useSignal(0)
  const products = usePromise(async (signal) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const res = await client.api.products.$get({}, { init: { signal } })
    return res.json()
  }, [])

  return (
    <>
      <Head.Content>
        <title>Streaming Demo</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <h2 className="text-2xl font-bold">Streaming Response Demo</h2>
        <div className="max-w-2xl text-center space-y-4">
          <p>This page demonstrates SSR with streamed data from the server.</p>
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Products:</p>
            <p className="text-sm text-neutral-300">
              <Derive from={products} fallback="Loading...">
                {(data, isStale) => (
                  <ul className={isStale ? "opacity-50" : ""}>
                    {data.products.map((product) => (
                      <li key={product.id}>{product.title}</li>
                    ))}
                  </ul>
                )}
              </Derive>
            </p>
          </div>
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Interactive Counter (Client-side):</p>
            <button
              type="button"
              onclick={() => count.value++}
              className="bg-blue-500 hover:bg-blue-600 rounded px-4 py-2 mt-2"
            >
              Count: {count}
            </button>
            <p className="text-sm text-neutral-400 mt-2">
              Hydration completes immediately, so this button is interactive
              before our streamed content is even rendered.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
