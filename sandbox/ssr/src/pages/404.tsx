import { Head, Link } from "kiru/router"

export default function NotFoundPage() {
  return (
    <>
      <Head.Content>
        <title>404 - Page Not Found</title>
      </Head.Content>
      <div className="flex flex-col gap-8 justify-center items-center">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="text-xl">Page Not Found</p>
        <p className="text-neutral-400">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="bg-blue-500 hover:bg-blue-600 rounded px-6 py-3"
        >
          Go Home
        </Link>
      </div>
    </>
  )
}
