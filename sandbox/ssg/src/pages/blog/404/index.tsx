import { Head, useFileRouter } from "kiru/router"

export default function Blog404() {
  const router = useFileRouter()
  return (
    <div>
      <Head.Content>
        <title>Blog 404 Route</title>
      </Head.Content>
      <h1>Blog 404 Route</h1>
      <p>src: {router.state.pathname}</p>
    </div>
  )
}
