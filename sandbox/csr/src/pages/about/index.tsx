import { useFileRouter } from "kiru/router"

export default function AboutPage() {
  const router = useFileRouter()

  return (
    <div>
      <h1>About Us</h1>
      <p>This page is wrapped by both the root layout and the about layout!</p>
      <p>
        You can see the navigation from the root layout and the sidebar from the
        about layout.
      </p>
      <p>Current path: {router.state.pathname}</p>
      <p>Query params: {JSON.stringify(router.state.query)}</p>
      <button onclick={() => router.navigate("/")}>Go Home</button>
    </div>
  )
}
