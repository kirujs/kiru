import { useFileRouter } from "kiru/router"
import { Head } from "kiru/router"

export default function DynamicPage() {
  const { state } = useFileRouter()
  const id = state.params.id || "unknown"
  const serverTime = new Date().toISOString()

  return (
    <>
      <Head.Content>
        <title>Dynamic Route - {id}</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <h2 className="text-2xl font-bold">Dynamic Route Demo</h2>
        <div className="max-w-2xl text-center space-y-4">
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Route Parameter:</p>
            <p className="text-xl text-blue-400">{id}</p>
          </div>
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Server Render Time:</p>
            <p className="text-sm text-neutral-300">{serverTime}</p>
          </div>
          <p className="text-sm text-neutral-400">
            Try visiting /dynamic/123 or /dynamic/hello to see different IDs
          </p>
        </div>
      </div>
    </>
  )
}
