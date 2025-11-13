import { useSignal } from "kiru"
import { Head } from "kiru/router"

export default function StreamingPage() {
  const count = useSignal(0)
  const serverTime = new Date().toISOString()

  return (
    <>
      <Head.Content>
        <title>Streaming Demo</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <h2 className="text-2xl font-bold">Streaming Response Demo</h2>
        <div className="max-w-2xl text-center space-y-4">
          <p>
            This page demonstrates SSR with client-side hydration. The initial
            HTML is rendered on the server, then JavaScript takes over for
            interactivity.
          </p>
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Server Render Time:</p>
            <p className="text-sm text-neutral-300">{serverTime}</p>
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
              This button works after hydration completes
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
