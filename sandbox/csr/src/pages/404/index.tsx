import { useFileRouter } from "kiru/router"

export default function _404Page() {
  const router = useFileRouter()

  return (
    <>
      <h1>404 - {router.state.pathname}</h1>
      <p>Page not found</p>
    </>
  )
}
