import { Head } from "kiru/router"

export default function AboutPage() {
  const serverTime = new Date().toISOString()

  return (
    <>
      <Head.Content>
        <title>About - SSR Demo</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <h2 className="text-2xl font-bold">About This SSR Demo</h2>
        <div className="max-w-2xl text-center space-y-4">
          <p>
            This page demonstrates Server-Side Rendering (SSR) with Kiru. The
            content you see was rendered on the server at request time.
          </p>
          <div className="bg-neutral-50/10 rounded p-4">
            <p className="font-semibold">Server Render Time:</p>
            <p className="text-sm text-neutral-300">{serverTime}</p>
          </div>
          <p className="text-sm text-neutral-400">
            Refresh the page to see the timestamp update - this proves the page
            is being rendered on the server for each request.
          </p>
        </div>
      </div>
    </>
  )
}
