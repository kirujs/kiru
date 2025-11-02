import { Head, useFileRouter } from "kiru/router"

export default function _404Page() {
  const router = useFileRouter()
  return (
    <>
      <Head.Content>
        <title>404 - {router.state.path}</title>
      </Head.Content>
      <h1>404 - {router.state.path}</h1>
    </>
  )
}
